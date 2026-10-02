import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { afterSignInPath } from '@/features/auth/after-sign-in';
import { AuthShell } from '../../auth-shell';
import { TwoStepForm } from './two-step-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('twoStepTitle') };
}

export default async function TwoStepPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.user.totpEnabledAt || session.mfaVerifiedAt) redirect(await afterSignInPath());
  const t = await getTranslations('login');
  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('twoStepTitle')}</h1>
        <p className="text-[16px] text-muted">{t('twoStepBody')}</p>
      </div>
      <TwoStepForm />
    </AuthShell>
  );
}
