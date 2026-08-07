import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { ProfileForm } from '@/components/ProfileForm';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Modifier mon profil' };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { interests: { orderBy: { label: 'asc' } } },
  });

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
    </>
  );
}
