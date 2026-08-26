'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { db } from './db';
import { sendPasswordResetEmail } from './email';
import { dummyHash, hashPassword, needsRehash, verifyPassword } from './password';
import { claimPasswordReset, issuePasswordReset } from './password-reset';
import {
  LOGIN_PER_EMAIL,
  LOGIN_PER_IP,
  RESET_PER_EMAIL,
  RESET_PER_IP,
  SIGNUP_PER_IP,
  clearAttempts,
  rateLimit,
  recordAttempt,
  retryMessage,
} from './rate-limit';
import { acceptInvite } from './invite-actions';
import { DEFAULT_LOCALE, isLocale } from './i18n/locales';
import { nameKey } from './name-key';
import { getLocale, getT } from './i18n/server';
import { createSession, destroyAllSessions, destroySession, requireUser } from './session';
import { siteUrl } from './site';
import { emailSchema, fieldErrors, loginSchema, passwordSchema, signupSchema } from './validation';

export type FormState = { errors?: Record<string, string>; done?: boolean };

/**
 * The caller's address, for rate limiting.
 *
 * x-forwarded-for is set by the platform's proxy and cannot be trusted from a
 * direct connection — but on Vercel nothing reaches the function without
 * passing through it, so the first entry is the real client. Falls back to a
 * single shared bucket rather than to no limit at all: an unknown address
 * still gets throttled, just together with every other unknown one.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  /*
   * Nobody is signed in yet, so getLocale() falls back to Accept-Language —
   * which is exactly the guess we want here. It seeds the account's language
   * AND the name of the list created below, so an English speaker does not
   * arrive to a list called "Mes envies".
   */
  const locale = await getLocale();
  const t = await getT();

  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Per IP only: there is no account to key on yet, and the limit is what
  // stops a script from creating accounts in a loop.
  const ip = await clientIp();
  const throttled = await rateLimit('signup:ip', ip, SIGNUP_PER_IP);
  if (!throttled.allowed) {
    return { errors: { form: retryMessage(throttled.retryAfter, t) } };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // Counts against the limit: probing which addresses already have an
    // account is exactly what the per-IP cap is there to slow down.
    await recordAttempt('signup:ip', ip);
    return { errors: { email: 'error.emailTaken' } };
  }

  // The name is a username: one person per name, compared case-folded.
  // Probing which names are taken is inherent to usernames everywhere, so it
  // is not hidden — but it is throttled like the e-mail probe above.
  const key = nameKey(name);
  if (await db.user.findUnique({ where: { nameKey: key }, select: { id: true } })) {
    await recordAttempt('signup:ip', ip);
    return { errors: { name: 'error.nameTaken' } };
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        name,
        nameKey: key,
        email,
        passwordHash: await hashPassword(password),
        locale,
        // Everyone gets a default list, so the app is never empty on arrival.
        lists: { create: { name: t('lists.defaultName'), isDefault: true } },
      },
    });
  } catch (error) {
    // Two sign-ups racing for one name or one address: the checks above both
    // passed, the unique index refused the second. Same answer as if the
    // check had caught it.
    if (isUniqueViolation(error)) {
      return { errors: { name: 'error.nameTaken' } };
    }
    throw error;
  }

  await createSession(user.id);

  /*
   * An invitation rides along from the link they followed.
   *
   * Applied here so the friendship exists before they see the app for the
   * first time: arriving to an empty Kadlio and having to search for the person
   * who invited you is precisely the friction the link removes.
   *
   * Failures are swallowed on purpose. The account is created and the session
   * is live; a revoked or malformed code must not turn that into an error
   * page. They land signed in, simply without the friendship.
   */
  await applyInvite(formData);

  /*
   * A new account goes to the questionnaire; a returning one does not.
   *
   * It is the only moment somebody has nothing in the app yet, so it is the
   * only moment asking is not an interruption — and content_facet, the tier
   * that carries recommendations at launch, has nothing to read until they
   * answer. Skipping it is a link on the page.
   */
  redirect('/welcome');
}

/** Consumes an invite code carried through an auth form, if there is one. */
async function applyInvite(formData: FormData): Promise<void> {
  const code = formData.get('invite');
  if (typeof code !== 'string' || !code) return;
  try {
    await acceptInvite(code);
  } catch {
    // Never at the cost of the sign-in itself.
  }
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  /*
   * Two limits, checked before the password is ever verified.
   *
   * Per e-mail catches a targeted attack on one account; per IP catches the
   * spray across many that a per-e-mail limit cannot see. Both refuse with the
   * same message shape as a bad password, so the throttle does not become an
   * oracle for which addresses exist.
   */
  const ip = await clientIp();
  const [byEmail, byIp] = await Promise.all([
    rateLimit('login:email', parsed.data.email, LOGIN_PER_EMAIL),
    rateLimit('login:ip', ip, LOGIN_PER_IP),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    const retryAfter = Math.max(
      byEmail.allowed ? 0 : byEmail.retryAfter,
      byIp.allowed ? 0 : byIp.retryAfter,
    );
    return { errors: { form: retryMessage(retryAfter, t) } };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  // Same message whether the account is missing or the password is wrong:
  // distinguishing them tells an attacker which addresses are registered.
  const invalid = { errors: { form: 'error.badCredentials' } };

  // Only a failure is recorded, against both buckets. A correct password
  // consumes nobody's allowance, so a shared address does not throttle itself
  // simply by being used.
  const fail = async () => {
    await Promise.all([
      recordAttempt('login:email', parsed.data.email),
      recordAttempt('login:ip', ip),
    ]);
    return invalid;
  };

  if (!user) {
    /*
     * A real hash, so the miss costs what a hit costs.
     *
     * This used to verify against the literal 'scrypt:00:00', which is
     * rejected on shape before scrypt is ever called — an unknown address
     * answered in microseconds and a known one in hundreds of milliseconds.
     * Measured at ~4850x, which is a stopwatch away from telling anybody
     * which addresses are registered, and undoes the identical messages above.
     */
    await verifyPassword(parsed.data.password, await dummyHash());
    return fail();
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail();
  }

  // A successful sign-in clears the failures that preceded it, so someone who
  // mistyped twice is not refused on their next legitimate attempt.
  await clearAttempts('login:email', parsed.data.email);

  /*
   * Sign-in is the only moment the plaintext exists, so it is the only moment
   * a hash made at an older cost can be brought up to the current one. Failure
   * is swallowed: an upgrade that did not happen is worth retrying next time,
   * never worth refusing a correct password over.
   */
  if (needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(parsed.data.password);
    await db.user
      .update({ where: { id: user.id }, data: { passwordHash: upgraded } })
      .catch(() => {});
  }

  await createSession(user.id);
  await applyInvite(formData);
  redirect('/app');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}

/**
 * "Mot de passe oublié" — the half that only needs an address.
 *
 * The answer is the same whether or not an account exists, to the byte AND
 * to the millisecond: the throttle charges every attempt, the user lookup
 * runs in both cases, and everything that depends on the answer — minting
 * the token, sending the e-mail — happens in after(), once the response has
 * already left. The login action equalises its timings with dummyHash() for
 * the same reason: this form must not be an oracle for which addresses have
 * accounts.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const parsed = z.object({ email: emailSchema }).safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const email = parsed.data.email;

  const ip = await clientIp();
  const [byEmail, byIp] = await Promise.all([
    rateLimit('reset:email', email, RESET_PER_EMAIL),
    rateLimit('reset:ip', ip, RESET_PER_IP),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    const retryAfter = Math.max(
      byEmail.allowed ? 0 : byEmail.retryAfter,
      byIp.allowed ? 0 : byIp.retryAfter,
    );
    return { errors: { form: retryMessage(retryAfter, t) } };
  }

  // Recorded whether or not the address has an account: what is limited is
  // the outbound e-mail, and charging only real accounts would let anybody
  // read account existence off the throttle after three tries.
  await Promise.all([
    recordAttempt('reset:email', email),
    recordAttempt('reset:ip', ip),
  ]);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, locale: true },
  });

  after(async () => {
    if (!user) return;
    const { token, id } = await issuePasswordReset(user.id);
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
      url: `${siteUrl()}/reset-password?token=${token}`,
      tokenId: id,
    });
  });

  return { done: true };
}

/**
 * The e-mailed half of a password change.
 *
 * The link stands in for the current password: claiming its token is the
 * proof of control, spent atomically and exactly once (see
 * claimPasswordReset). What follows mirrors changePassword — new hash and
 * every session gone in one transaction — and ends signed in, because the
 * person has just proven they own the mailbox the account answers to.
 */
export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      token: z.string().min(1, 'error.resetInvalid'),
      password: passwordSchema,
    })
    .safeParse({
      token: formData.get('token'),
      password: formData.get('password'),
    });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const claimed = await claimPasswordReset(parsed.data.token);
  // One answer for unknown, expired and already used: telling them apart
  // tells a guesser which of its guesses were close.
  if (!claimed) return { errors: { form: 'error.resetInvalid' } };

  const hash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: claimed.userId }, data: { passwordHash: hash } }),
    destroyAllSessions(claimed.userId),
  ]);

  // The link proved they are the owner; the failed guesses that drove them
  // here must not refuse their brand-new password at the door.
  await clearAttempts('login:email', claimed.email);

  await createSession(claimed.userId);
  redirect('/app');
}

/**
 * Changing a password from inside the account.
 *
 * The signed-in half of the pair — resetPassword above is the e-mailed one.
 * There, a claimed token proves control of the mailbox; here nothing has
 * been proven, so the current password is required: a session left open on
 * a shared machine would otherwise be enough to lock its owner out of their
 * own account.
 */
export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({
      current: z.string().min(1, 'error.passwordRequired'),
      next: passwordSchema,
    })
    .safeParse({
      current: formData.get('current'),
      next: formData.get('next'),
    });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const row = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { errors: { current: 'error.badCredentials' } };
  }

  if (parsed.data.next === parsed.data.current) {
    return { errors: { next: 'error.passwordUnchanged' } };
  }

  const hash = await hashPassword(parsed.data.next);

  /*
   * Every other session goes with it — and every reset link still in flight.
   *
   * Changing a password because somebody else may have it is pointless if the
   * session they are already holding keeps working, or if a "choose a new
   * password" e-mail sitting in some inbox still opens the account: an
   * outstanding reset link is a second password. The current session is
   * spared and reissued, so the person doing this is not signed out of the
   * tab they are typing in.
   */
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
    destroyAllSessions(user.id),
    db.passwordReset.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id);

  return { done: true };
}

/** Prisma's unique-index refusal, the one error a racing write may produce. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
