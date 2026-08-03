import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import { getCurrentUser } from '@/lib/session';
import styles from './landing.module.css';

export default async function LandingPage() {
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
          Ajoutez ce qui vous ferait plaisir. Vos amis réservent, se regroupent
          pour les gros cadeaux, et vous ne voyez jamais qui a pris quoi. La
          surprise est garantie par l&rsquo;application, pas par leur discrétion.
        </p>

        <div className={styles.actions}>
          <ButtonLink href="/signup">Créer mon compte</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Se connecter
          </ButtonLink>
        </div>

        <ul className={styles.points}>
          <li>
            <strong>Le secret est structurel.</strong> Les réservations ne sont
            jamais envoyées au propriétaire de la liste, même pas sous forme de
            compteur.
          </li>
          <li>
            <strong>À plusieurs pour les gros cadeaux.</strong> Une cagnotte par
            cadeau, avec un salon de discussion invisible pour l&rsquo;intéressé.
          </li>
          <li>
            <strong>Rien ne se perd.</strong> Anniversaires, listes de Noël et
            envies gardées d&rsquo;une année sur l&rsquo;autre.
          </li>
        </ul>
      </div>
    </main>
  );
}
