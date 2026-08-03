import { logout } from '@/lib/auth-actions';
import { Button } from '@/components/Button';
import { getListsForViewer } from '@/lib/gifts';
import { requireUser } from '@/lib/session';

export default async function AppHomePage() {
  const user = await requireUser();
  const lists = await getListsForViewer(user.id, user.id);

  return (
    <main style={{ padding: 'var(--gutter)', maxWidth: 720, margin: '0 auto' }}>
      <h1>Bonjour {user.name}</h1>
      <p>Vous avez {lists.length} liste(s).</p>
      <ul>
        {lists.map((l) => (
          <li key={l.id}>
            {l.name} — {l.giftCount} envie(s)
          </li>
        ))}
      </ul>
      <form action={logout}>
        <Button variant="secondary" type="submit">
          Se déconnecter
        </Button>
      </form>
    </main>
  );
}
