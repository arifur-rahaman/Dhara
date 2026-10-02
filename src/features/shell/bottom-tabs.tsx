'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';
import type { NavItem } from './nav';

/** Mobile tab bar, 76px (docs/design: OwnerToday, MunshiToday, StaffToday). */
export function BottomTabs({ items, className = '' }: { items: NavItem[]; className?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <ul
        className="mx-auto grid h-tabbar max-w-[640px] px-1 pt-1.5 pb-3.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ section, href, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={section}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full min-h-12 flex-col items-center justify-center gap-[3px] text-[12px] ${
                  active ? 'font-semibold text-accent' : 'text-muted'
                }`}
              >
                <Icon name={icon} />
                <span>{t(section)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
