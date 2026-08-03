import { requireUser } from '@/lib/session';

/**
 * Everything under this layout requires a session.
 *
 * Guarding here rather than in middleware means the check runs against the
 * database, not against an unverified cookie, and every nested page inherits it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
