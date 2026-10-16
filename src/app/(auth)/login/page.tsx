import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { env } from '@/server/env';
import { afterSignInPath } from '@/features/auth/after-sign-in';
import { AuthShell } from '../auth-shell';
import { PhoneForm } from './phone-form';

export async function generateMetadata({ searchParams }: PageProps<'/login'>): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: (await searchParams).new === '1' ? t('signupTitle') : t('title') };
}

/**
 * Login and sign-up (docs/design/Main.dc.html, simplified at the project owner's request): one form for
 * every chamber role. ?new=1 is the "open a new chamber" view, which asks for the email up front when
 * sign-in codes go by email.
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const session = await getSession();
  if (session?.mfaVerifiedAt) redirect(await afterSignInPath());
  const [t, g] = await Promise.all([getTranslations('login'), getTranslations('guide')]);
  const signup = (await searchParams).new === '1';

  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{signup ? t('signupTitle') : t('title')}</h1>
        <p className="text-[16px] text-muted">{signup ? t('signupSubtitle') : t('subtitle')}</p>
      </div>

      <Link
        href="/guide"
        className="flex min-h-11 items-center justify-center rounded-[12px] border border-border px-4 text-[15px] font-semibold text-accent"
      >
        {g('link')}
      </Link>

      <PhoneForm askEmail={signup && env().OTP_CHANNEL === 'email'} showPassword={!signup} />

      <div className="flex flex-col items-center gap-1 border-t border-border pt-5 text-[15px]">
        <span className="text-muted">{signup ? t('haveAccount') : t('newHere')}</span>
        <Link
          href={signup ? '/login' : '/login?new=1'}
          className="flex h-11 items-center px-3 font-semibold text-accent"
        >
          {signup ? t('title') : t('signupTitle')}
        </Link>
      </div>
    </AuthShell>
  );
}
