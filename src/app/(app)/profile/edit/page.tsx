import type { Metadata } from 'next';
import { DecorationPicker } from '@/components/DecorationPicker';
import { LifeEvents } from '@/components/LifeEvents';
import { SectionTitle } from '@/components/display';
import { PageHeader } from '@/components/PageHeader';
import { ProfileForm } from '@/components/ProfileForm';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { categoriesForInterests } from '@/lib/taxonomy';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('profile.editTitle') };
}

export default async function EditProfilePage() {
  const t = await getT();
  const user = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      interests: { orderBy: { label: 'asc' } },
      decorations: true,
      events: { orderBy: [{ month: 'asc' }, { day: 'asc' }] },
    },
  });

  // Keyed by slot, which is how the picker reads them.
  const decorations = Object.fromEntries(
    profile.decorations.map((d) => [d.slot, d]),
  );

  return (
    <>
      <PageHeader
        title={t('profile.editTitle')}
        subtitle={t('profile.editSubtitle')}
        back={{ href: '/profile', label: 'Profil' }}
      />
      <ProfileForm
        initial={{
          name: profile.name,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          /*
             Derived rather than read straight through, so an interest stored
             before the list closed — "Café", typed when this was free text —
             arrives as the categories it maps to and is preserved by the next
             save instead of being dropped on the floor.
          */
          interests: categoriesForInterests(profile.interests.map((i) => i.label)),
          gender: profile.gender ?? '',
          ageBracket: profile.ageBracket ?? '',
        }}
      />

      <section style={{ marginTop: 32 }}>
        <SectionTitle>{t('events.mine')}</SectionTitle>
        <LifeEvents events={profile.events} />
      </section>

      <section style={{ marginTop: 32 }}>
        <SectionTitle>{t('profile.decorate')}</SectionTitle>
        <DecorationPicker initial={decorations} />
      </section>
    </>
  );
}
