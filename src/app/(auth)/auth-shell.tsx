import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPreferences } from '@/features/preferences/server';

/** Shared frame for sign-in, onboarding and invitation screens (Main / Onboarding designs). */
export async function AuthShell({ children, brand = true }: { children: ReactNode; brand?: boolean }) {
  const { locale } = await getPreferences();
  const t = await getTranslations('app');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-7 px-6 pt-12 pb-7">
      <div className="flex items-center justify-between">
        {brand ? (
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-[16px] font-semibold">{t('name')}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <LanguageToggle current={locale} />
          <ThemeToggle />
        </div>
      </div>
      {children}
    </main>
  );
}
