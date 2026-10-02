import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { AuthShell } from '../../auth-shell';
import { TwoStepSetup } from './setup';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('twoStep');
  return { title: t('title') };
}

/** TOTP setup. Required for owners after onboarding; optional for other roles (from Settings). */
export default async function TwoStepSetupPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.totpEnabledAt) redirect(session.mfaVerifiedAt ? '/settings' : '/login/two-step');
  const t = await getTranslations('twoStep');
  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[30px] leading-[1.3] font-normal">{t('title')}</h1>
        <p className="text-[15px] text-muted">{t('why')}</p>
      </div>
      <TwoStepSetup />
    </AuthShell>
  );
}
