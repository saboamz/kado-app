import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AcceptInvite } from '@/components/AcceptInvite';
import { ButtonLink } from '@/components/Button';
import { Avatar } from '@/components/display';
import { readInvite } from '@/lib/invite-actions';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './invite.module.css';

/**
 * Where an invitation link lands.
 *
 * Readable signed out on purpose: somebody arriving from a group chat has to
 * see WHO is inviting them before deciding whether to sign up. A name and a
 * photo are already visible to anyone they befriend, so showing them here
 * gives away nothing that accepting would not.
 *
 * Nothing is acted on by loading this page — a link that created a friendship
 * on GET would fire on every preview crawler that touches it.
 */
export const metadata: Metadata = {
  title: 'Invitation',
  // Not in search results: these are private links shared between people.
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getT();
  const { code } = await params;
  const viewer = await getCurrentUser();
  const invite = await readInvite(code, viewer?.id ?? null);

  if (invite.state === 'invalid') {
    return (
      <Frame title={t('invite.unknownTitle')}>
        <p className={styles.body}>
          Le lien est peut-être incomplet. Demandez-en un nouveau à la personne
          qui vous a invité.
        </p>
        <ButtonLink href="/">{t('invite.goHome')}</ButtonLink>
      </Frame>
    );
  }

  const firstName = invite.owner.name.trim().split(/\s+/)[0] ?? invite.owner.name;

  if (invite.state === 'revoked') {
    return (
      <Frame title={t('invite.closedTitle')}>
        <p className={styles.body}>
          {firstName} n’utilise plus ce lien. Demandez-lui le nouveau.
        </p>
        <ButtonLink href="/">{t('invite.goHome')}</ButtonLink>
      </Frame>
    );
  }

  // Your own link: you are not going to befriend yourself, and the useful
  // thing to do is send it to somebody.
  if (invite.state === 'self') redirect('/friends');

  if (invite.state === 'already') {
    return (
      <Frame title={`Vous êtes déjà amis avec ${firstName}`}>
        <p className={styles.body}>
          Vous voyez déjà ses listes, et {firstName} voit les vôtres.
        </p>
        <ButtonLink href="/friends">{t('invite.seeFriends')}</ButtonLink>
      </Frame>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Avatar name={invite.owner.name} url={invite.owner.avatarUrl} size={72} />

        <h1 className={styles.title}>
          {invite.owner.name} vous invite sur Kado
        </h1>
        <p className={styles.body}>
          Vous verrez sa liste d’envies, et pourrez réserver un cadeau sans
          qu’{firstName} ne le sache — c’est tout l’intérêt.
        </p>

        {viewer ? (
          // Signed in: one click and it is done.
          <AcceptInvite code={code} name={firstName} />
        ) : (
          <>
            {/*
              Signed out: the code rides along so the friendship lands the
              moment the account exists, rather than sending them back here to
              start again.
            */}
            <ButtonLink href={`/signup?invite=${encodeURIComponent(code)}`} block>
              {t('landing.createAccount')}
            </ButtonLink>
            <ButtonLink
              href={`/login?invite=${encodeURIComponent(code)}`}
              variant="secondary"
              block
            >
              J’ai déjà un compte
            </ButtonLink>
          </>
        )}
      </div>
    </main>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </main>
  );
}
