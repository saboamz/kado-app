/**
 * Inline stroke icons.
 *
 * Bundled rather than pulled from an icon package: there are eight of them,
 * they inherit currentColor, and it keeps the dependency list short.
 */
type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const HomeIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </svg>
);

export const GiftIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3.5 11h17v9.5h-17z" />
    <path d="M2.5 7h19v4h-19zM12 7v13.5" />
    <path d="M12 7S10.5 3 8 3a2.2 2.2 0 0 0 0 4.4h4ZM12 7s1.5-4 4-4a2.2 2.2 0 0 1 0 4.4h-4Z" />
  </svg>
);

export const SearchIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5" />
  </svg>
);

export const BellIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const UserIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
  </svg>
);

export const PlusIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="m14.5 5-7 7 7 7" />
  </svg>
);

export const UsersIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8.5" r="3.6" />
    <path d="M2.8 19.5c0-3.2 2.8-5.3 6.2-5.3s6.2 2.1 6.2 5.3" />
    <path d="M16.5 5.2a3.6 3.6 0 0 1 0 6.9M17.5 14.6c2.2.5 3.7 2.2 3.7 4.9" />
  </svg>
);

export const SettingsIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2 1.2M17.7 15.3l2 1.2M4.3 16.5l2-1.2M17.7 8.7l2-1.2" />
  </svg>
);

export const LockIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </svg>
);
