import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { SettingsForm } from '@/components/SettingsForm';
import { DeleteAccount } from '@/components/DeleteAccount';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from '@/components/forms.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('settings.title') };
}

export default async function SettingsPage() {
  const t = await getT();
  const user = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { theme: true, profilePublic: true, currency: true, locale: true },
  });

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        back={{ href: '/profile', label: 'Profil' }}
      />

      <SettingsForm initial={profile} />

      <section className={styles.danger}>
        <p className={styles.dangerTitle}>{t('settings.deleteAccount')}</p>
        <p className={styles.dangerBody}>
          {t('settings.deleteWarning')}
          supprimés. Les cadeaux que vous aviez réservés chez vos proches
          redeviendront disponibles.
        </p>
        <DeleteAccount />
      </section>
    </>
  );
}
