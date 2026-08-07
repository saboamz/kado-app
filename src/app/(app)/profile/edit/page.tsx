import type { Metadata } from 'next';
import { DecorationPicker } from '@/components/DecorationPicker';
import { SectionTitle } from '@/components/display';
import { PageHeader } from '@/components/PageHeader';
import { ProfileForm } from '@/components/ProfileForm';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Modifier mon profil' };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      interests: { orderBy: { label: 'asc' } },
      decorations: true,
    },
  });

  // Keyed by slot, which is how the picker reads them.
  const decorations = Object.fromEntries(
    profile.decorations.map((d) => [d.slot, d]),
  );

  return (
    <>
      <PageHeader
        title="Modifier mon profil"
        subtitle="Ce que vos proches voient de vous."
        back={{ href: '/profile', label: 'Profil' }}
      />
      <ProfileForm
        initial={{
          name: profile.name,
          bio: profile.bio,
          // The input wants YYYY-MM-DD; the column stores a full timestamp.
          birthday: profile.birthday
            ? profile.birthday.toISOString().slice(0, 10)
            : '',
          avatarUrl: profile.avatarUrl,
          interests: profile.interests.map((i) => i.label).join(', '),
        }}
      />

      <section style={{ marginTop: 32 }}>
        <SectionTitle>Décorer mon profil</SectionTitle>
        <DecorationPicker initial={decorations} />
      </section>
    </>
  );
}
