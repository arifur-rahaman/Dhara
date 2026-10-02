import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitch } from '@/components/language-switch';
import { ThemeSwitch } from '@/components/theme-switch';
import { getPreferences } from '@/features/preferences/server';
import { previewAsRole } from '@/features/shell/actions';
import { roles } from '@/features/shell/nav';
import { previewEnabled } from '@/features/shell/preview-role';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

export default async function LoginPage() {
  const { locale } = await getPreferences();
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <BrandMark />
        <span className="text-[20px] font-semibold">{t('app.name')}</span>
      </div>

      <LanguageSwitch current={locale} />

      <section className="flex flex-col gap-2">
        <h1 className="page-title">{t('login.title')}</h1>
        <p className="text-muted">{t('app.tagline')}</p>
        <p className="text-[15px] text-muted">{t('login.subtitle')}</p>
      </section>

      <p className="rounded-card border border-border bg-surface p-4 text-[15px]">{t('login.comingSoon')}</p>

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

      <div className="mt-auto">
        <ThemeSwitch />
      </div>
    </main>
  );
}
