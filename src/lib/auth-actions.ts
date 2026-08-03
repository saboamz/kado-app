'use server';

import { redirect } from 'next/navigation';
import { db } from './db';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { fieldErrors, loginSchema, signupSchema } from './validation';

export type FormState = { errors?: Record<string, string> };

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

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
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

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  // Same message whether the account is missing or the password is wrong:
  // distinguishing them tells an attacker which addresses are registered.
  const invalid = { errors: { form: 'E-mail ou mot de passe incorrect.' } };
  if (!user) {
    // Spend comparable time so the response does not reveal the miss either.
    await verifyPassword(parsed.data.password, 'scrypt:00:00');
    return invalid;
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return invalid;
  }

  await createSession(user.id);
  redirect('/app');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}
