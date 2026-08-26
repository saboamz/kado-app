import type { Metadata } from 'next';
import { EmptyState, SectionTitle, Stack } from '@/components/display';
import { SearchIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { PersonCard } from '@/components/PersonCard';
import { SearchField } from '@/components/SearchField';
import { searchPeople } from '@/lib/people';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('search.title') };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getT();
  const { q } = await searchParams;
  const user = await requireUser();
  const query = q?.trim() ?? '';

  const results = query ? await searchPeople(query, user.id) : [];

  return (
    <>
      <PageHeader
        title={t('search.title')}
        subtitle={t('search.subtitle')}
      />

      <SearchField defaultValue={query} />

      {query ? (
        <>
          <SectionTitle>
            {t('common.results', { count: results.length })}
          </SectionTitle>
          {results.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={24} />}
              title={t('search.nobodyTitle')}
              body={t('search.nobodyBody')}
            />
          ) : (
            <Stack>
              {results.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </Stack>
          )}
        </>
      ) : (
        // No query, no list: this page used to suggest strangers here, and
        // a directory of people who never asked to be found is not what a
        // search box promises. You reach somebody by name or address, or by
        // their invitation link — nothing else.
        <EmptyState
          icon={<SearchIcon size={24} />}
          title={t('search.hintTitle')}
          body={t('search.hintBody')}
        />
      )}
    </>
  );
}
