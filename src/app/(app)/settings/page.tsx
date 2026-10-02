import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { requireCtx } from '@/server/context';
import { signOut } from '@/features/auth/actions';
import { PasswordForm } from '@/features/account/password-form';
import { getPreferences } from '@/features/preferences/server';
import { LanguageSetting, NumeralsSetting, ThemeSetting } from '@/features/preferences/settings-controls';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

/**
 * Settings (docs/design/Settings.dc.html): Display (M0) and Security & account (M1).
 * Font size (M6), reminders (M5), devices (M6) and subscription (M3) follow.
 */
export default async function SettingsPage() {
  const { locale, numerals } = await getPreferences();
  const t = await getTranslations('settings');
  // Pages render alongside the layout, so each page checks the session itself.
  await requireCtx();
  const user = (await getSession())!.user;

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

      <section aria-labelledby="settings-security" className="flex flex-col gap-1.5">
        <h2 id="settings-security" className="px-1 text-[13px] font-semibold text-muted">
          {t('security')}
        </h2>
        <div className="flex flex-col rounded-card border border-border bg-surface px-4">
          <div className="flex min-h-[52px] items-center justify-between gap-3">
            <span className="text-[15px]">{t('twoStep')}</span>
            {user.totpEnabledAt ? (
              <span className="rounded-full bg-ok-bg px-2.5 py-[3px] text-[12px] font-semibold text-ok">{t('on')}</span>
            ) : (
              <Link href="/security/two-step" className="text-[14px] font-semibold text-accent">
                {t('turnOn')}
              </Link>
            )}
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-border">
            <span className="text-[15px]">{t('password')}</span>
            <span className="text-[14px] text-muted">{user.passwordHash ? t('passwordSet') : t('passwordNotSet')}</span>
          </div>
          <div className="border-t border-border">
            <PasswordForm />
          </div>
          <form action={signOut} className="border-t border-border">
            <button className="flex min-h-[52px] w-full items-center text-[15px] font-semibold text-lock-text">
              {t('signOut')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
