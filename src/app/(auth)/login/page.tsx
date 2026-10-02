import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import { Icon } from '@/components/icons';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPreferences } from '@/features/preferences/server';
import { previewAsRole } from '@/features/shell/actions';
import { roles } from '@/features/shell/nav';
import { previewEnabled } from '@/features/shell/preview-role';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

/** Login screen from docs/design/MainEnglish.dc.html and Main.dc.html. Sign-in itself arrives in M1. */
export default async function LoginPage() {
  const { locale } = await getPreferences();
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-7 px-6 pt-12 pb-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-[16px] font-semibold">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle current={locale} />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('login.title')}</h1>
        <p className="text-[16px] text-muted">{t('login.subtitle')}</p>
      </div>

      <form className="flex flex-col gap-3" aria-describedby="login-coming-soon">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-phone" className="text-[14px] font-semibold">
            {t('login.phone')}
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t('login.phonePlaceholder')}
            disabled
            className="h-[52px] rounded-control border border-border bg-surface px-4 text-[17px] disabled:opacity-70"
          />
        </div>
        <button
          type="submit"
          disabled
          className="mt-1 h-[52px] rounded-control bg-accent text-[17px] font-semibold text-on-accent disabled:opacity-60"
        >
          {t('login.sendOtp')}
        </button>
        <button
          type="button"
          disabled
          className="h-12 rounded-control border border-border text-[16px] font-medium disabled:opacity-60"
        >
          {t('login.withPassword')}
        </button>
        <p id="login-coming-soon" className="text-[13px] text-muted">
          {t('login.comingSoon')}
        </p>
      </form>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-[18px]">
        <h2 className="text-[15px] font-semibold">{t('login.noRoleTitle')}</h2>
        <p className="text-[14px] text-muted">{t('login.noRoleBody')}</p>
        <ul className="flex flex-wrap gap-2">
          {roles.map((role, i) => (
            <li
              key={role}
              className={`rounded-full px-3 py-1.5 text-[13px] ${
                i === 0 ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2 font-medium'
              }`}
            >
              {t(`roles.${role}`)}
            </li>
          ))}
        </ul>
      </section>

      {previewEnabled && (
        <section className="flex flex-col gap-3 rounded-card border border-dashed border-border p-4">
          <h2 className="text-[15px] font-semibold">{t('login.previewTitle')}</h2>
          <p className="text-[13px] text-muted">{t('login.previewHint')}</p>
          <form action={previewAsRole} className="grid grid-cols-2 gap-2">
            {roles.map((role) => (
              <button
                key={role}
                name="role"
                value={role}
                className="min-h-11 rounded-control border border-border bg-surface px-3 text-[15px] font-medium hover:bg-surface-2"
              >
                {t(`roles.${role}`)}
              </button>
            ))}
          </form>
        </section>
      )}

      <p className="mt-auto flex items-start gap-2 text-[13px] text-muted">
        <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
        <span>{t('login.security')}</span>
      </p>
    </main>
  );
}
