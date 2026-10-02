'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { NavItem } from './nav';

export function BottomTabs({ items, className = '' }: { items: NavItem[]; className?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <ul className="mx-auto flex h-tabbar max-w-[640px]">
        {items.map(({ section, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={section} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full min-h-11 flex-col items-center justify-center gap-1 text-[12px] ${
                  active ? 'font-semibold text-accent' : 'font-medium text-muted'
                }`}
              >
                {active && <span aria-hidden="true" className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent" />}
                <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
                <span>{t(section)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
