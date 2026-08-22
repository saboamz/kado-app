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

/**
 * The five destinations, in order.
 *
 * Labels arrive from the server layout rather than being read here: this is a
 * client component, so it has no access to the request's locale, and shipping
 * a dictionary to the browser to translate five words would be worse than
 * passing five words.
 */
const TABS = [
  { href: '/app', key: 'home', Icon: HomeIcon },
  { href: '/lists', key: 'lists', Icon: GiftIcon },
  { href: '/search', key: 'search', Icon: SearchIcon },
  { href: '/notifications', key: 'alerts', Icon: BellIcon },
  { href: '/profile', key: 'profile', Icon: UserIcon },
] as const;

export type NavLabels = {
  main: string;
  skip: string;
  home: string;
  lists: string;
  search: string;
  alerts: string;
  profile: string;
  unread: string;
};

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
  labels,
}: {
  children: ReactNode;
  unreadCount?: number;
  /** Shown at the far right of the desktop bar; absent on a phone. */
  user?: { name: string; avatarUrl?: string | null };
  /** Translated in the layout, which can read the locale. */
  labels: NavLabels;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      {/*
        The nav precedes the content in the DOM whatever its visual position,
        so without this a keyboard or screen-reader user crossed the wordmark,
        five destinations and the profile link on every single page load
        before reaching what they came for.
      */}
      <a href="#main" className={styles.skip}>
        {labels.skip}
      </a>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label={labels.main}>
          <Link href="/app" className={styles.brand}>
            Kadlio
          </Link>

          {TABS.map(({ href, key, Icon }) => {
            const label = labels[key];
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
                  {/*
                    Sized explicitly. The icons default to 22px while .navIcon
                    is a smaller grid cell, so an unsized <Icon /> overflowed
                    its box and pulled its optical centre below the label's —
                    which is what made the desktop bar look misaligned.
                  */}
                  <Icon size={20} />
                  {showBadge && (
                    <span className={styles.navBadge}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                      <span className="srOnly"> {labels.unread}</span>
                    </span>
                  )}
                </span>
                <span className={styles.navLabel}>{label}</span>
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

        <main id="main" tabIndex={-1} className={styles.main}>
          <div className={styles.container}>{children}</div>
        </main>
      </div>
    </div>
  );
}
