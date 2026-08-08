import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './landing.module.css';

export default async function LandingPage() {
  const t = await getT();
  // Someone already signed in has no use for the pitch.
  if (await getCurrentUser()) redirect('/app');

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            K
          </span>
          Kado
        </span>

        <h1 className={styles.title}>
          Des listes de souhaits que vos proches remplissent en secret.
        </h1>
        <p className={styles.lede}>
          {t('landing.lede')}
          pour les gros cadeaux, et vous ne voyez jamais qui a pris quoi. La
          surprise est garantie par l&rsquo;application, pas par leur discrétion.
        </p>

        <div className={styles.actions}>
          <ButtonLink href="/signup">{t('landing.createAccount')}</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Se connecter
          </ButtonLink>
        </div>

        <ul className={styles.points}>
          <li>
            <strong>{t('landing.point1')}</strong> Les réservations ne sont
            jamais envoyées au propriétaire de la liste, même pas sous forme de
            compteur.
          </li>
          <li>
            <strong>{t('landing.point2')}</strong> Une cagnotte par
            cadeau, avec un salon de discussion invisible pour l&rsquo;intéressé.
          </li>
          <li>
            <strong>{t('landing.point3')}</strong> Anniversaires, listes de Noël et
            envies gardées d&rsquo;une année sur l&rsquo;autre.
          </li>
        </ul>
      </div>
    </main>
  );
}
