import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '../../auth-shell';
import { PasswordForm } from './password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('withPassword') };
}

/** Password sign-in. Not in the designs; follows the login screen's layout. */
export default async function PasswordPage() {
  const t = await getTranslations('login');
  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('withPassword')}</h1>
        <p className="text-[16px] text-muted">{t('passwordHint')}</p>
      </div>
      <PasswordForm />
    </AuthShell>
  );
}
