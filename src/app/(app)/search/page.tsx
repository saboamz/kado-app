import type { Metadata } from 'next';
import { EmptyState, SectionTitle, Stack } from '@/components/display';
import { SearchIcon } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { PersonCard } from '@/components/PersonCard';
import { SearchField } from '@/components/SearchField';
import { searchPeople, suggestPeople } from '@/lib/people';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Rechercher' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await requireUser();
  const query = q?.trim() ?? '';

  const results = query ? await searchPeople(query, user.id) : [];
  const suggestions = query ? [] : await suggestPeople(user.id);

  return (
    <>
      <PageHeader
        title="Rechercher"
        subtitle="Trouvez vos proches pour voir leurs listes."
      />

      <SearchField defaultValue={query} />

      {query ? (
        <>
          <SectionTitle>
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </SectionTitle>
          {results.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={24} />}
              title="Personne trouvée"
              body="Essayez un autre nom, ou l'adresse e-mail exacte de la personne."
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
        <>
          <SectionTitle>Suggestions</SectionTitle>
          {suggestions.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={24} />}
              title="Personne à suggérer"
              body="Cherchez vos proches par nom ou par adresse e-mail."
            />
          ) : (
            <Stack>
              {suggestions.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </Stack>
          )}
        </>
      )}
    </>
  );
}
