'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { Sidebar } from '@/features/shell/sidebar';
import { adminNav } from './nav';

/**
 * Platform admin portal shell. It is a separate route group now; from M3 it is
 * served on its own subdomain with its own session, IP allowlist and TOTP.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  return (
    <div className="min-h-dvh">
      <Sidebar
        className="flex"
        label={t('nav.label')}
        items={adminNav.map(({ section, ...rest }) => ({ ...rest, label: t(`nav.${section}`) }))}
        header={
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-[17px] font-semibold">{t('title')}</span>
          </div>
        }
      />
      <main id="main" className="ml-sidebar px-10 py-10">
        {children}
      </main>
    </div>
  );
}
