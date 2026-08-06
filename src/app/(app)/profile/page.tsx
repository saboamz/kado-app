import type { Metadata } from 'next';
import { Button, ButtonLink } from '@/components/Button';
import { Avatar, Badge, Card, SectionTitle, Stack } from '@/components/display';
import { SettingsIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { logout } from '@/lib/auth-actions';
import { db } from '@/lib/db';
import { friendIds } from '@/lib/relations';
import { requireUser } from '@/lib/session';
import styles from './profile.module.css';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage() {
  const user = await requireUser();

  const [profile, friends, listCount, giftCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { interests: true },
    }),
    friendIds(user.id),
    db.giftList.count({ where: { ownerId: user.id } }),
    db.gift.count({ where: { list: { ownerId: user.id } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Profil"
        actions={
          <ButtonLink href="/settings" variant="secondary">
            <SettingsIcon size={18} />
            Paramètres
          </ButtonLink>
        }
      />

      <Card className={styles.identity}>
        <Avatar
          name={profile.name}
          url={profile.avatarUrl}
          size={72}
        />
        <div className={styles.identityText}>
          <h2 className={styles.name}>{profile.name}</h2>
          <p className={styles.email}>{profile.email}</p>
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        </div>
      </Card>

      <dl className={styles.stats}>
        <div>
          <dd>{listCount}</dd>
          <dt>Listes</dt>
        </div>
        <div>
          <dd>{giftCount}</dd>
          <dt>Envies</dt>
        </div>
        <div>
          <dd>{friends.length}</dd>
          <dt>Amis</dt>
        </div>
      </dl>

      {profile.interests.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>Centres d&rsquo;intérêt</SectionTitle>
          <ul className={styles.interests}>
            {profile.interests.map((i) => (
              <li key={i.id}>
                <Badge>{i.label}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <Stack>
          <ButtonLink href="/friends" variant="secondary" block>
            Mes amis ({friends.length})
          </ButtonLink>
          <ButtonLink href="/profile/edit" variant="secondary" block>
            Modifier mon profil
          </ButtonLink>
          <form action={logout}>
            <Button variant="danger" type="submit" block>
              Se déconnecter
            </Button>
          </form>
        </Stack>
      </section>
    </>
  );
}
