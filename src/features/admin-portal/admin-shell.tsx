'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { Avatar, Sidebar } from '@/features/shell/sidebar';
import { adminSignOut } from './actions';
import { adminNav } from './nav';

/**
 * Platform admin portal shell (SuperAdmin design). Served on its own origin (ADMIN_URL) with its own
 * session, IP allowlist and TOTP at every sign-in; see src/proxy.ts and src/server/admin.
 */
export function AdminShell({
  children,
  name,
  role,
}: {
  children: ReactNode;
  name: string;
  role: 'super_admin' | 'support';
}) {
  const t = useTranslations();
  return (
    <div className="min-h-dvh">
      <Sidebar
        variant="dark"
        className="flex"
        label={t('admin.nav.label')}
        items={adminNav.map(({ section, href, icon }) => ({ href, icon, label: t(`admin.nav.${section}`) }))}
        header={
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-[10px] bg-nav-active text-nav-text"
            >
              <Icon name="shield" size={18} />
            </span>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold">{t('app.name')}</span>
              <span className="text-[12px] text-nav-muted">{t('admin.title')}</span>
            </div>
          </div>
        }
        footer={
          <>
            <Avatar initial={name.trim().charAt(0) || '?'} tone="dark" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-semibold">{name}</span>
              <span className="text-[12px] text-nav-muted">{t(`admin.roles.${role}`)}</span>
            </div>
            <form action={adminSignOut}>
              <button className="flex h-11 items-center px-2 text-[13px] font-semibold text-nav-muted underline hover:text-nav-text">
                {t('admin.signOut')}
              </button>
            </form>
          </>
        }
      />
      <main id="main" className="ml-sidebar flex flex-col gap-5 px-10 pt-7 pb-8">
        <div className="flex">
          <span className="flex items-center gap-2 rounded-full bg-lock-bg px-3.5 py-[7px] text-[13px] font-semibold text-lock-text">
            <Icon name="shield" size={16} />
            {t('admin.banner')}
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
