'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { LOCALES } from './i18n/locales';
import { rateLimit, recordAttempt, UPLOAD_PER_USER } from './rate-limit';
import { nameKey } from './name-key';
import { requireUser } from './session';
import { SURVEY_CATEGORIES } from './taxonomy';
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
  // '' means "rather not say", and is stored as NULL — see survey-actions.
  gender: z.enum(['', 'FEMALE', 'MALE', 'OTHER']),
  ageBracket: z.enum([
    '',
    'AGE_15_24',
    'AGE_25_34',
    'AGE_35_44',
    'AGE_45_54',
    'AGE_55_64',
    'AGE_65_PLUS',
  ]),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    bio: formData.get('bio'),
    gender: formData.get('gender') ?? '',
    ageBracket: formData.get('ageBracket') ?? '',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { name, bio, gender, ageBracket } = parsed.data;

  // A username is one per person: refuse a name somebody ELSE already holds,
  // compared case-folded. Your own name, retyped in another case, is yours.
  const key = nameKey(name);
  const holder = await db.user.findUnique({ where: { nameKey: key }, select: { id: true } });
  if (holder && holder.id !== user.id) {
    return { errors: { name: 'error.nameTaken' } };
  }

  const current = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  // Same three-way decision as a gift image: picked, removed, or unchanged.
  let avatarUrl: string | null | undefined;
  const file = formData.get('avatar');
  if (file instanceof File && file.size > 0) {
    // Same ceiling as a gift photo — see resolveImage in gift-actions.
    const budget = await rateLimit('upload', user.id, UPLOAD_PER_USER);
    if (!budget.allowed) return { errors: { avatar: 'error.tooManyUploads' } };
    await recordAttempt('upload', user.id);

    const stored = await storeUpload(file, 'avatars');
    if (!stored.ok) return { errors: { avatar: stored.error } };
    await deleteUpload(current.avatarUrl);
    avatarUrl = stored.path;
  } else if (formData.get('avatarRemoved') === '1') {
    await deleteUpload(current.avatarUrl);
    avatarUrl = null;
  }

  /*
   * Ticked boxes, checked against the closed list rather than trusted.
   *
   * This was a comma-separated line anybody could type into, which is what
   * the closed category list exists to end: content_facet matches on the
   * value, so "tech", "Tech" and "high-tech" are three buckets nobody shares.
   * Free text now lives in the bio, which nothing matches on.
   */
  const offered = new Set<string>(SURVEY_CATEGORIES);
  const labels = [
    ...new Set(
      formData
        .getAll('interests')
        .filter((v): v is string => typeof v === 'string')
        .filter((v) => offered.has(v)),
    ),
  ];

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        name,
        nameKey: key,
        bio: bio || null,
        gender: gender || null,
        ageBracket: ageBracket || null,
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
