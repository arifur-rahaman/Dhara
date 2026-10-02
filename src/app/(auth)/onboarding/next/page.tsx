import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCtx } from '@/server/context';
import { AuthShell } from '../../auth-shell';
import { Steps } from '../steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

/** Onboarding steps 2 and 3: import (arrives in M6, skippable) and inviting the team. */
export default async function OnboardingNextPage() {
  const ctx = await getCtx();
  if (!ctx) redirect('/onboarding');
  if (ctx.role !== 'owner') redirect('/today');
  const t = await getTranslations('onboarding');

  return (
    <AuthShell brand={false}>
      <Steps current={3} />
      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <h2 className="text-[16px] font-semibold">{t('importTitle')}</h2>
        <p className="text-[14px] text-muted">{t('importBody')}</p>
      </section>
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 className="text-[16px] font-semibold">{t('inviteTitle')}</h2>
        <p className="text-[14px] text-muted">{t('inviteBody')}</p>
        <Link
          href="/team/invite"
          className="flex h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
        >
          {t('inviteNow')}
        </Link>
      </section>
      <Link
        href="/today"
        className="mt-auto flex h-12 items-center justify-center rounded-control border border-border text-[16px] font-medium"
      >
        {t('later')}
      </Link>
    </AuthShell>
  );
}
