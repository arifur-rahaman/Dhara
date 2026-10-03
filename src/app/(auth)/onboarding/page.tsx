import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { getCtx } from '@/server/context';
import { withTenant } from '@/server/db/tenant';
import { acceptInvitation } from '@/features/team/actions';
import { AuthShell } from '../auth-shell';
import { ChamberForm, ConsentForm } from './forms';
import { Steps } from './steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

/**
 * Onboarding (docs/design/Onboarding.dc.html) with a consent step first (plan.md section 8, PDPO).
 * People with an open invitation to their phone can join that chamber instead of creating one.
 */
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.totpEnabledAt && !session.mfaVerifiedAt) redirect('/login/two-step');
  const t = await getTranslations();

  if (!session.user.privacyConsentAt) {
    return (
      <AuthShell brand={false}>
        <div className="flex flex-col gap-2">
          <h1 className="font-title text-[32px] leading-[1.3] font-normal">{t('onboarding.consentTitle')}</h1>
        </div>
        <ul className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-[15px]">
          {(['consent1', 'consent2', 'consent3', 'consent4', 'consent5'] as const).map((k) => (
            <li key={k} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{t(`onboarding.${k}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-muted">{t('onboarding.consentNote')}</p>
        <ConsentForm />
      </AuthShell>
    );
  }

  if (await getCtx()) redirect('/today');

  const invitations = await withTenant({ userId: session.userId, userPhone: session.user.phone }, (tx) =>
    tx.invitation.findMany({
      where: { phone: session.user.phone, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { chamber: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );

  return (
    <AuthShell brand={false}>
      <Steps current={1} />
      {invitations.length > 0 && (
        <section className="flex flex-col gap-3 rounded-card border border-accent bg-accent-soft p-4">
          <h2 className="text-[15px] font-semibold">{t('onboarding.invitedTitle')}</h2>
          {invitations.map((inv) => (
            <form key={inv.id} action={acceptInvitation} className="flex items-center justify-between gap-3">
              <input type="hidden" name="invitationId" value={inv.id} />
              <span className="text-[14px]">
                {t('onboarding.invitedBody', { chamber: inv.chamber.name, role: t(`roles.${inv.role}`) })}
              </span>
              <button className="h-11 shrink-0 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">
                {t('onboarding.join')}
              </button>
            </form>
          ))}
          <span className="text-[13px] text-muted">{t('onboarding.orOwn')}</span>
        </section>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="font-title text-[32px] leading-[1.3] font-normal">{t('onboarding.title')}</h1>
        <p className="text-[16px] text-muted">{t('onboarding.subtitle')}</p>
      </div>
      <ChamberForm defaultName={session.user.name ?? undefined} />
    </AuthShell>
  );
}
