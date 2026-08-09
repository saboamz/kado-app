'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { LOCALES } from './i18n/locales';
import { requireUser } from './session';
import { deleteUpload, storeUpload } from './uploads';
import { fieldErrors } from './validation';

export type FormState = { errors?: Record<string, string>; saved?: boolean };

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(max, 'error.textLong'));

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'error.nameRequired')
    .max(80, 'error.nameLong'),
  bio: optionalText(280),
  birthday: optionalText(10).refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    'Date invalide.',
  ),
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
    interests: formData.get('interests'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { name, bio, birthday, interests } = parsed.data;

  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  // Same three-way decision as a gift image: picked, removed, or unchanged.
  let avatarUrl: string | null | undefined;
  const file = formData.get('avatar');
  if (file instanceof File && file.size > 0) {
    const stored = await storeUpload(file, 'avatars');
    if (!stored.ok) return { errors: { avatar: stored.error } };
    await deleteUpload(current.avatarUrl);
    avatarUrl = stored.path;
  } else if (formData.get('avatarRemoved') === '1') {
    await deleteUpload(current.avatarUrl);
    avatarUrl = null;
  }

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
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
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
  /* Validated against the closed list rather than taken as free text: an
     unknown value would render the app in no language at all. */
  locale: z.enum(LOCALES),
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
    locale: formData.get('locale') ?? 'fr',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.user.update({
    where: { id: user.id },
    data: {
      theme: parsed.data.theme,
      profilePublic: !!parsed.data.profilePublic,
      currency: parsed.data.currency,
      locale: parsed.data.locale,
    },
  });

  // The theme and the language both live on <html>, set from the session in
  // the root layout — so the whole tree has to be revalidated, not this page.
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

  /*
   * The event log has to be cleared by hand.
   *
   * GiftEvent carries actorId and recipientId as plain strings with no
   * relation to User, so no cascade reaches it — deleting an account left
   * every row it had produced sitting in the table indefinitely, keyed to a
   * person who had asked to be forgotten. That is a right to erasure the app
   * was not honouring, and no amount of privacy policy makes it acceptable.
   *
   * Deleted rather than anonymised: the id IS the only identifying part, and
   * a log of "somebody once added a wish" is worth nothing to the recommender
   * without knowing who, so there is nothing here to preserve.
   *
   * Before the user row, so a failure leaves the account intact and the
   * person can try again, rather than half-deleted with orphaned events.
   */
  await db.giftEvent.deleteMany({
    where: { OR: [{ actorId: user.id }, { recipientId: user.id }] },
  });

  await db.user.delete({ where: { id: user.id } });
  redirect('/');
}
