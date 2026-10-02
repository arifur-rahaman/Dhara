import type { IconName } from '@/components/icons';

export const adminSections = ['dashboard', 'chambers', 'subscriptions', 'support', 'team', 'audit'] as const;
export type AdminSection = (typeof adminSections)[number];

/** From docs/design/SuperAdmin.dc.html. */
export const adminNav: { section: AdminSection; href: `/admin/${string}`; icon: IconName }[] = [
  { section: 'dashboard', href: '/admin/dashboard', icon: 'dashboard' },
  { section: 'chambers', href: '/admin/chambers', icon: 'cases' },
  { section: 'subscriptions', href: '/admin/subscriptions', icon: 'accounts' },
  { section: 'support', href: '/admin/support', icon: 'lock' },
  { section: 'team', href: '/admin/team', icon: 'team' },
  { section: 'audit', href: '/admin/audit', icon: 'list' },
];

export function isAdminSection(value: string): value is AdminSection {
  return (adminSections as readonly string[]).includes(value);
}
