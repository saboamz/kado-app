import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { SignupSurvey } from '@/components/SignupSurvey';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('survey.title') };
}

/**
 * The questionnaire, once, just after signing up.
 *
 * Not part of the sign-up form: every field added there costs accounts, and
 * none of these is worth an account. The page is reachable afterwards only by
 * typing the URL — the profile is where these answers are edited from then on.
 */
export default async function WelcomePage() {
  const t = await getT();
  await requireUser();

  return (
    <>
      <PageHeader title={t('survey.title')} subtitle={t('survey.subtitle')} />
      <SignupSurvey />
    </>
  );
}
