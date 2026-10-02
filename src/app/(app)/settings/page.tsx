import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitch } from '@/components/language-switch';
import { NumeralsSwitch } from '@/components/numerals-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { getPreferences } from '@/features/preferences/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

/** M0 part of Settings: language, digits and theme. The rest arrives in M5–M6. */
export default async function SettingsPage() {
  const { locale, numerals } = await getPreferences();
  const t = await getTranslations('settings');

  return (
    <div className="flex max-w-[560px] flex-col gap-6">
      <h1 className="page-title">{t('title')}</h1>

      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <h2 className="text-[16px] font-semibold">{t('language')}</h2>
        <LanguageSwitch current={locale} hideLegend />
        {locale === 'bn' && <NumeralsSwitch current={numerals} />}
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <h2 className="text-[16px] font-semibold">{t('display')}</h2>
        <ThemeSwitch />
      </section>
    </div>
  );
}
