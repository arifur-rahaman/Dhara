'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { BottomTabs } from './bottom-tabs';
import { navByRole, type Role } from './nav';
import { Sidebar, useNavLabels } from './sidebar';

/**
 * Chamber app shell. Below 768px every role gets its bottom tab bar.
 * From 768px the owner gets the web sidebar (plan.md M0, TECH_GUIDE section 9).
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const t = useTranslations();
  const nav = navByRole[role];
  const sidebarItems = useNavLabels(nav.sidebar ?? []);
  const hasSidebar = nav.sidebar !== null;

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-30 rounded-control bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>

      {hasSidebar && (
        <Sidebar
          className="hidden md:flex"
          label={t('nav.label')}
          items={sidebarItems}
          header={
            <div className="flex items-center gap-3">
              <BrandMark size={36} />
              <div className="flex flex-col">
                <span className="text-[17px] font-semibold">{t('app.name')}</span>
                <span className="text-[13px] text-nav-muted">{t(`roles.${role}`)}</span>
              </div>
            </div>
          }
        />
      )}

      <main
        id="main"
        className={`mx-auto w-full px-5 pt-6 pb-[calc(var(--spacing-tabbar)+24px)] ${
          hasSidebar ? 'md:ml-sidebar md:w-auto md:max-w-none md:px-10 md:pt-10 md:pb-10' : 'max-w-[640px]'
        }`}
      >
        {children}
      </main>

      <BottomTabs items={nav.tabs} className={hasSidebar ? 'md:hidden' : ''} />
    </div>
  );
}
