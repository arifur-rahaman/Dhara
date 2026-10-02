'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';

export type SidebarItem = { href: string; label: string; icon: IconName };

/**
 * Web sidebar, 248px. `light` is the chamber app (TeamRoles, Reports);
 * `dark` is the platform admin portal (SuperAdmin).
 */
export function Sidebar({
  label,
  header,
  footer,
  items,
  variant,
  className = '',
}: {
  label: string;
  header: ReactNode;
  footer: ReactNode;
  items: SidebarItem[];
  variant: 'light' | 'dark';
  className?: string;
}) {
  const pathname = usePathname();
  const dark = variant === 'dark';
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 w-sidebar flex-col gap-1 px-4 py-6 ${
        dark ? 'bg-nav text-nav-text' : 'border-r border-border bg-surface text-text'
      } ${className}`}
    >
      <div className="px-2 pb-5">{header}</div>
      <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label: text, icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const tone = active
              ? dark
                ? 'bg-nav-active font-semibold text-nav-text'
                : 'bg-accent-soft font-semibold text-accent'
              : dark
                ? 'text-nav-muted hover:text-nav-text'
                : 'text-muted hover:text-text';
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${tone}`}
                >
                  <Icon name={icon} size={20} />
                  <span>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        className={`mt-auto flex items-center gap-2.5 rounded-[12px] p-3 ${dark ? 'bg-nav-active' : 'bg-surface-2'}`}
      >
        {footer}
      </div>
    </aside>
  );
}

/** Round initial avatar used in the sidebar footer card. */
export function Avatar({ initial, tone }: { initial: string; tone: 'light' | 'dark' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full font-title text-[17px] ${
        tone === 'dark' ? 'bg-nav text-nav-text' : 'bg-accent-soft text-accent'
      }`}
    >
      {initial}
    </span>
  );
}
