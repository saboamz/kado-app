'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { hashPassword, verifyPassword } from './password';
import {
  LOGIN_PER_EMAIL,
  LOGIN_PER_IP,
  SIGNUP_PER_IP,
  clearAttempts,
  rateLimit,
  recordAttempt,
  retryMessage,
} from './rate-limit';
import { createSession, destroySession } from './session';
import { fieldErrors, loginSchema, signupSchema } from './validation';

export type FormState = { errors?: Record<string, string> };

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
    return { errors: { form: retryMessage(throttled.retryAfter) } };
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
    return { errors: { email: 'Un compte existe déjà avec cette adresse.' } };
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      // Everyone gets a default list, so the app is never empty on arrival.
      lists: { create: { name: 'Mes envies', isDefault: true } },
    },
  });

  await createSession(user.id);
  redirect('/app');
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
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
    return { errors: { form: retryMessage(retryAfter) } };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  // Same message whether the account is missing or the password is wrong:
  // distinguishing them tells an attacker which addresses are registered.
  const invalid = { errors: { form: 'E-mail ou mot de passe incorrect.' } };

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
    // Spend comparable time so the response does not reveal the miss either.
    await verifyPassword(parsed.data.password, 'scrypt:00:00');
    return fail();
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail();
  }

  // A successful sign-in clears the failures that preceded it, so someone who
  // mistyped twice is not refused on their next legitimate attempt.
  await clearAttempts('login:email', parsed.data.email);

  await createSession(user.id);
  redirect('/app');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}
