'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { requireUser } from './session';
import { fieldErrors } from './validation';

export type FormState = { errors?: Record<string, string>; saved?: boolean };

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(max, 'Ce texte est trop long.'));

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Renseignez votre nom.')
    .max(80, 'Ce nom est trop long.'),
  bio: optionalText(280),
  birthday: optionalText(10).refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    'Date invalide.',
  ),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.')
    .optional()
    .or(z.literal('')),
  interests: optionalText(200),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    bio: formData.get('bio'),
    birthday: formData.get('birthday'),
    avatarColor: formData.get('avatarColor'),
    interests: formData.get('interests'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { name, bio, birthday, avatarColor, interests } = parsed.data;

  // Interests arrive as a comma-separated line; store them as rows so they
  // can be searched and counted later.
  const labels = [
    ...new Set(
      interests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  ];

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        name,
        bio: bio || null,
        birthday: birthday ? new Date(`${birthday}T00:00:00Z`) : null,
        ...(avatarColor ? { avatarColor } : {}),
      },
    }),
    db.interest.deleteMany({ where: { userId: user.id } }),
    db.interest.createMany({
      data: labels.map((label) => ({ userId: user.id, label })),
    }),
  ]);

  revalidatePath('/profile');
  revalidatePath(`/u/${user.id}`);
  redirect('/profile');
}

const settingsSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
  profilePublic: z.coerce.boolean().optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF', 'CAD']),
});

export async function updateSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = settingsSchema.safeParse({
    theme: formData.get('theme') ?? 'SYSTEM',
    profilePublic: formData.get('profilePublic') === 'on',
    currency: formData.get('currency') ?? 'EUR',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.user.update({
    where: { id: user.id },
    data: {
      theme: parsed.data.theme,
      profilePublic: !!parsed.data.profilePublic,
      currency: parsed.data.currency,
    },
  });

  // The theme lives on <html>, set from the session in the root layout.
  revalidatePath('/', 'layout');
  return { saved: true };
}

/**
 * Deletes the account and everything belonging to it.
 *
 * Cascades remove lists, gifts, reservations, contributions and messages —
 * including reservations this person holds on other people's lists, which
 * frees those gifts for somebody else.
 */
export async function deleteAccount(): Promise<void> {
  const user = await requireUser();
  await db.user.delete({ where: { id: user.id } });
  redirect('/');
}
