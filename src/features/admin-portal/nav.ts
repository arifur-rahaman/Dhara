import { Building2, CreditCard, LifeBuoy, ScrollText } from 'lucide-react';

export const adminSections = ['chambers', 'plans', 'support', 'audit'] as const;
export type AdminSection = (typeof adminSections)[number];

export const adminNav = [
  { section: 'chambers', href: '/admin/chambers', icon: Building2 },
  { section: 'plans', href: '/admin/plans', icon: CreditCard },
  { section: 'support', href: '/admin/support', icon: LifeBuoy },
  { section: 'audit', href: '/admin/audit', icon: ScrollText },
] as const satisfies ReadonlyArray<{ section: AdminSection; href: `/admin/${string}`; icon: unknown }>;

export function isAdminSection(value: string): value is AdminSection {
  return (adminSections as readonly string[]).includes(value);
}
