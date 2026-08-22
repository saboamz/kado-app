'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from './db';
import { requireUser } from './session';
import { SURVEY_INTERESTS } from './taxonomy';
import { fieldErrors } from './validation';

export type SurveyState = { errors?: Record<string, string> };

/**
 * The questionnaire offered once, just after signing up.
 *
 * ── What it is for ─────────────────────────────────────────────────────────
 *
 * content_facet is the tier that carries recommendations at launch, and it
 * reads Interest rows. On the day somebody signs up there are none, so it
 * returns nothing for them and nothing about them. This is the cheapest
 * moment to ask, and the only one where asking is not an interruption.
 *
 * ── What it deliberately does not ask ──────────────────────────────────────
 *
 * Nothing in Article 9 of the GDPR: no religion, health, ethnicity, political
 * opinion or orientation. Age is a bracket rather than a date of birth,
 * because a date identifies a person and a decade does not, and the
 * recommender cannot tell the difference.
 *
 * Every answer is optional, and skipping the page entirely is a link. An
 * unanswered question is stored as NULL: a refusal is not a category.
 */
const surveySchema = z.object({
  // '' is what an unanswered radio group sends, and it means "rather not say".
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

export async function saveSurvey(
  _prev: SurveyState,
  formData: FormData,
): Promise<SurveyState> {
  const user = await requireUser();

  const parsed = surveySchema.safeParse({
    gender: formData.get('gender') ?? '',
    ageBracket: formData.get('ageBracket') ?? '',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  /*
   * Checked against the offered list rather than trusted.
   *
   * These are form values, so they are whatever the caller sends. An interest
   * outside the mapping table maps to no category, which makes content_facet
   * quietly return less — the exact silent failure the table exists to stop.
   */
  const offered = new Set<string>(SURVEY_INTERESTS);
  const interests = formData
    .getAll('interests')
    .filter((v): v is string => typeof v === 'string')
    .filter((v) => offered.has(v))
    .slice(0, SURVEY_INTERESTS.length);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        gender: parsed.data.gender || null,
        ageBracket: parsed.data.ageBracket || null,
      },
    }),
    /*
     * Replaced, not added to. The questionnaire is the whole answer at this
     * point, and running it twice must not leave the first attempt behind.
     */
    db.interest.deleteMany({ where: { userId: user.id } }),
    db.interest.createMany({
      data: interests.map((label) => ({ userId: user.id, label })),
    }),
  ]);

  revalidatePath('/app');
  revalidatePath('/profile');
  revalidatePath('/profile/edit');

  // Straight into the app: the questionnaire is a doorway, not a destination,
  // and leaving somebody on it with a saved form is a dead end.
  redirect('/app');
}
