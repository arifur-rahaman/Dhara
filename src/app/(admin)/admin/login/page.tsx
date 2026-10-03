import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAdmin } from '@/server/admin/session';
import { AuthShell } from '@/app/(auth)/auth-shell';
import { AdminLoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.login');
  return { title: t('title') };
}

/** Admin sign-in. Not in the designs; follows the chamber app's password screen. */
export default async function AdminLoginPage() {
  if (await getAdmin()) redirect('/admin/dashboard');
  const t = await getTranslations('admin.login');
  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('title')}</h1>
        <p className="text-[16px] text-muted">{t('hint')}</p>
      </div>
      <AdminLoginForm />
    </AuthShell>
  );
}
