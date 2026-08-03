import type { Metadata } from 'next';
import { ButtonLink } from '@/components/Button';
import { Badge, CardLink, EmptyState, Grid } from '@/components/display';
import { GiftIcon, LockIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { getListsForViewer } from '@/lib/gifts';
import { requireUser } from '@/lib/session';
import styles from './lists.module.css';

export const metadata: Metadata = { title: 'Mes listes' };

const VISIBILITY = {
  PRIVATE: { label: 'Privée', Icon: LockIcon },
  FRIENDS: { label: 'Amis', Icon: UsersIcon },
  PUBLIC: { label: 'Publique', Icon: UsersIcon },
} as const;

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await getListsForViewer(user.id, user.id);

  return (
    <>
      <PageHeader
        title="Mes listes"
        subtitle="Ce que vous aimeriez recevoir, rangé par occasion."
        actions={
          <ButtonLink href="/lists/new">
            <PlusIcon size={18} />
            Nouvelle liste
          </ButtonLink>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={<GiftIcon size={24} />}
          title="Aucune liste pour l'instant"
          body="Créez une liste — anniversaire, Noël, ou simplement vos envies du moment."
          action={<ButtonLink href="/lists/new">Créer une liste</ButtonLink>}
        />
      ) : (
        <Grid>
          {lists.map((list) => {
            const { label, Icon } = VISIBILITY[list.visibility];
            return (
              <CardLink key={list.id} href={`/lists/${list.id}`}>
                <div className={styles.top}>
                  <span className={styles.name}>{list.name}</span>
                  {list.isDefault && <Badge>Par défaut</Badge>}
                </div>
                {list.occasion && (
                  <span className={styles.occasion}>{list.occasion}</span>
                )}
                <div className={styles.meta}>
                  <span className={styles.count}>
                    {list.giftCount} envie{list.giftCount > 1 ? 's' : ''}
                  </span>
                  <span className={styles.visibility}>
                    <Icon size={14} />
                    {label}
                  </span>
                </div>
              </CardLink>
            );
          })}
        </Grid>
      )}
    </>
  );
}
