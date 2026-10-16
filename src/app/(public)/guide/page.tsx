import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPreferences } from '@/features/preferences/server';
import { guide } from '@/features/guide/content';
import { GuideView } from '@/features/guide/guide-view';
import { getSession } from '@/server/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guide');
  return { title: t('title') };
}

/** User guide (content/guide.bn.json). Open to everyone, signed in or not, linked from the login page. */
export default async function GuidePage() {
  const [{ locale }, t, app, session] = await Promise.all([
    getPreferences(),
    getTranslations('guide'),
    getTranslations('app'),
    getSession(),
  ]);
  const back = session?.mfaVerifiedAt ? '/today' : '/login';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col gap-8 px-5 pt-10 pb-16 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={back} className="flex items-center gap-3">
          <BrandMark />
          <span className="text-[16px] font-semibold">{app('name')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle current={locale} />
          <ThemeToggle />
        </div>
      </div>
      <header className="flex flex-col gap-3">
        <h1 className="font-title text-[36px] leading-[1.25] font-normal">{t('title')}</h1>
        <p lang="bn" className="text-[16.5px] leading-[1.8] text-muted">
          {guide.intro}
        </p>
        {locale !== 'bn' && <p className="text-[14px] text-muted">{t('banglaOnly')}</p>}
        <Link href={back} className="self-start text-[15px] font-semibold text-accent">
          {session?.mfaVerifiedAt ? t('backToApp') : t('backToLogin')}
        </Link>
      </header>
      <GuideView />
      <footer lang="bn" className="border-t border-border pt-4 text-[14px] text-muted">
        {guide.footer} {t('updated', { date: guide.updated })}
      </footer>
    </main>
  );
}
