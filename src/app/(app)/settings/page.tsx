import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { SettingsForm } from '@/components/SettingsForm';
import { DeleteAccount } from '@/components/DeleteAccount';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import styles from '@/components/forms.module.css';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { theme: true, profilePublic: true, currency: true },
  });

  return (
    <>
      <PageHeader
        title="Paramètres"
        back={{ href: '/profile', label: 'Profil' }}
      />

      <SettingsForm initial={profile} />

      <section className={styles.danger}>
        <p className={styles.dangerTitle}>Supprimer mon compte</p>
        <p className={styles.dangerBody}>
          Vos listes, vos envies et vos messages seront définitivement
          supprimés. Les cadeaux que vous aviez réservés chez vos proches
          redeviendront disponibles.
        </p>
        <DeleteAccount />
      </section>
    </>
  );
}
