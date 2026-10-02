'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { NavItem } from './nav';

export type SidebarItem = Omit<NavItem, 'section'> & { label: string };

/** Dark web sidebar (248px), used from 768px up. */
export function Sidebar({
  label,
  header,
  items,
  className = '',
}: {
  label: string;
  header: ReactNode;
  items: SidebarItem[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <aside className={`fixed inset-y-0 left-0 z-20 w-sidebar flex-col bg-nav text-nav-text ${className}`}>
      <div className="px-5 py-6">{header}</div>
      <nav aria-label={label} className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label: text, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${
                    active
                      ? 'bg-nav-active font-semibold text-nav-text'
                      : 'font-medium text-nav-muted hover:text-nav-text'
                  }`}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                  <span>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function useNavLabels(items: NavItem[]): SidebarItem[] {
  const t = useTranslations('nav');
  return items.map(({ section, ...rest }) => ({ ...rest, label: t(section) }));
}
