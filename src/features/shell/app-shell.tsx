'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { OfflineAgent } from '@/features/offline/agent';
import { BottomTabs } from './bottom-tabs';
import { navByRole, type Role } from './nav';
import { Avatar, Sidebar } from './sidebar';

/**
 * Chamber app shell. Below 768px every role gets its bottom tab bar.
 * From 768px the owner gets the web sidebar (TeamRoles, Reports designs).
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const t = useTranslations();
  const nav = navByRole[role];
  const hasSidebar = nav.sidebar !== null;

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-30 rounded-control bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>

      {nav.sidebar && (
        <Sidebar
          variant="light"
          className="hidden md:flex"
          label={t('nav.label')}
          items={nav.sidebar.map(({ section, href, icon }) => ({ href, icon, label: t(`nav.${section}`) }))}
          header={
            <div className="flex items-center gap-2.5">
              <BrandMark size={36} />
              <span className="text-[15px] font-semibold">{t('app.name')}</span>
            </div>
          }
          footer={
            <>
              <Avatar initial={t('shell.youInitial')} tone="light" />
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold">{t('shell.you')}</span>
                <span className="text-[12px] text-muted">{t(`roles.${role}`)}</span>
              </div>
            </>
          }
        />
      )}

      <OfflineAgent besideSidebar={hasSidebar} />

      <main
        id="main"
        className={`mx-auto w-full px-5 pt-6 pb-[calc(var(--spacing-tabbar)+24px)] ${
          hasSidebar ? 'md:ml-sidebar md:w-auto md:max-w-none md:px-10 md:pt-8 md:pb-8' : 'max-w-[640px]'
        }`}
      >
        {children}
      </main>

      <BottomTabs items={nav.tabs} className={hasSidebar ? 'md:hidden' : ''} />
    </div>
  );
}
