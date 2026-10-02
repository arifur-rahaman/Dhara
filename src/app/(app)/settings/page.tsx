import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getPreferences } from '@/features/preferences/server';
import { LanguageSetting, NumeralsSetting, ThemeSetting } from '@/features/preferences/settings-controls';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

/**
 * Settings (docs/design/Settings.dc.html). M0 builds the Display section.
 * Font size (M6), reminders (M5) and security and account (M1) follow.
 */
export default async function SettingsPage() {
  const { locale, numerals } = await getPreferences();
  const t = await getTranslations('settings');

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('title')} />
      <section aria-labelledby="settings-display" className="flex flex-col gap-1.5">
        <h2 id="settings-display" className="px-1 text-[13px] font-semibold text-muted">
          {t('display')}
        </h2>
        <div className="flex flex-col rounded-card border border-border bg-surface px-4 py-1">
          <LanguageSetting current={locale} />
          <ThemeSetting />
          {locale === 'bn' && <NumeralsSetting current={numerals} />}
        </div>
      </section>
    </div>
  );
}
