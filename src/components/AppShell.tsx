'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Avatar } from './display';
import {
  BellIcon,
  GiftIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from './icons';
import styles from './AppShell.module.css';

const TABS = [
  { href: '/app', label: 'Accueil', Icon: HomeIcon },
  { href: '/lists', label: 'Mes listes', Icon: GiftIcon },
  { href: '/search', label: 'Rechercher', Icon: SearchIcon },
  { href: '/notifications', label: 'Alertes', Icon: BellIcon },
  { href: '/profile', label: 'Profil', Icon: UserIcon },
];

/**
 * The application frame.
 *
 * The same nav element is a bottom tab bar on a phone and a sidebar from
 * 900px up — a CSS change, not a second component, so the two can never drift.
 */
export function AppShell({
  children,
  unreadCount = 0,
  user,
}: {
  children: ReactNode;
  unreadCount?: number;
  /** Shown at the far right of the desktop bar; absent on a phone. */
  user?: { name: string; avatarUrl?: string | null };
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Navigation principale">
          <Link href="/app" className={styles.brand}>
            Kado
          </Link>

          {TABS.map(({ href, label, Icon }) => {
            // `/app` must not light up for every route beneath it.
            const active =
              href === '/app' ? pathname === '/app' : pathname.startsWith(href);
            const showBadge = href === '/notifications' && unreadCount > 0;

            return (
              <Link
                key={href}
                href={href}
                className={styles.navItem}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <Icon />
                  {showBadge && (
                    <span className={styles.navBadge}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                      <span className="srOnly"> notifications non lues</span>
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}

          {user && (
            <Link href="/profile" className={styles.navUser}>
              {user.name}
              <Avatar name={user.name} url={user.avatarUrl} size={32} />
            </Link>
          )}
        </nav>

        <main className={styles.main}>
          <div className={styles.container}>{children}</div>
        </main>
      </div>
    </div>
  );
}
