'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { dummyHash, hashPassword, needsRehash, verifyPassword } from './password';
import {
  LOGIN_PER_EMAIL,
  LOGIN_PER_IP,
  SIGNUP_PER_IP,
  clearAttempts,
  rateLimit,
  recordAttempt,
  retryMessage,
} from './rate-limit';
import { acceptInvite } from './invite-actions';
import { getLocale, getT } from './i18n/server';
import { createSession, destroySession, requireUser } from './session';
import { fieldErrors, loginSchema, passwordSchema, signupSchema } from './validation';

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

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      locale,
      // Everyone gets a default list, so the app is never empty on arrival.
      lists: { create: { name: t('lists.defaultName'), isDefault: true } },
    },
  });

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

  redirect('/app');
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
 * Changing a password from inside the account.
 *
 * There is no reset flow — that needs e-mail, which the app does not send.
 * This is the half that needs nothing: somebody who is signed in and suspects
 * their password is known can replace it. Before this, the only remedy the
 * product offered was deleting the account.
 *
 * The current password is required. A session left open on a shared machine
 * would otherwise be enough to lock its owner out of their own account.
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
   * Every other session goes with it.
   *
   * Changing a password because somebody else may have it is pointless if the
   * session they are already holding keeps working. The current one is spared
   * and reissued, so the person doing this is not signed out of the tab they
   * are typing in.
   */
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id);

  return { done: true };
}
