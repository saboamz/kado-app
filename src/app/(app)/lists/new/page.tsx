import type { Metadata } from 'next';
import { ListForm } from '@/components/ListForm';
import { PageHeader } from '@/components/PageHeader';
import { createList } from '@/lib/list-actions';

export const metadata: Metadata = { title: 'Nouvelle liste' };

export default function NewListPage() {
  return (
    <>
      <PageHeader
        title="Nouvelle liste"
        subtitle="Une liste par occasion : anniversaire, Noël, ou vos envies du moment."
        back={{ href: '/lists', label: 'Mes listes' }}
      />
      <ListForm
        action={createList}
        submitLabel="Créer la liste"
        pendingLabel="Création…"
      />
    </>
  );
}
