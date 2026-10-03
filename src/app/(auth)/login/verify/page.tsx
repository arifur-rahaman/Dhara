import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { maskPhone } from '@/lib/phone';
import { prisma } from '@/server/db/client';
import { AuthShell } from '../../auth-shell';
import { CodeForm } from './code-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('verifyTitle') };
}

/** OTP entry. Not in the designs; follows the login screen's layout. */
export default async function VerifyPage({ searchParams }: PageProps<'/login/verify'>) {
  const c = z.uuid().safeParse((await searchParams).c);
  if (!c.success) redirect('/login');
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: c.data }, select: { phone: true } });
  if (!challenge) redirect('/login');
  const t = await getTranslations('login');

  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('verifyTitle')}</h1>
        <p className="text-[16px] text-muted">{t('verifySent', { phone: maskPhone(challenge.phone) })}</p>
      </div>
      <CodeForm challenge={c.data} />
      <Link href="/login" className="self-center text-[14px] font-semibold text-accent">
        {t('otherNumber')}
      </Link>
    </AuthShell>
  );
}
