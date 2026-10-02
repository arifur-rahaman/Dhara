import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { maskPhone } from '@/lib/phone';
import { getSession } from '@/server/auth/session';
import { sha256 } from '@/server/crypto';
import { withTenant } from '@/server/db/tenant';
import { acceptInvitation, continueInviteToSignIn } from '@/features/team/actions';
import { signOut } from '@/features/auth/actions';
import { AuthShell } from '../../auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invite');
  return { title: t('title'), robots: { index: false } };
}

/** Invitation link from SMS. Shows the chamber and role; accepting needs sign-in with the invited number. */
export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const t = await getTranslations();
  const valid = /^[\w-]{20,100}$/.test(token);
  const invitation = valid
    ? await withTenant({ inviteTokenHash: sha256(token) }, (tx) =>
        tx.invitation.findFirst({
          where: { tokenHash: sha256(token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          include: { chamber: { select: { name: true } } },
        }),
      )
    : null;

  if (!invitation) {
    return (
      <AuthShell>
        <h1 className="font-title text-[30px] leading-[1.3] font-normal">{t('invite.title')}</h1>
        <p role="alert" className="rounded-[12px] bg-lock-bg px-4 py-3 text-[15px] text-lock-text">
          {t('invite.invalid')}
        </p>
      </AuthShell>
    );
  }

  const session = await getSession();
  const phone = maskPhone(invitation.phone);
  const body = t('invite.body', {
    chamber: invitation.chamber.name,
    name: invitation.name,
    role: t(`roles.${invitation.role}`),
  });

  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[30px] leading-[1.3] font-normal">{t('invite.title')}</h1>
        <p className="text-[16px]">{body}</p>
      </div>
      {!session ? (
        <form action={continueInviteToSignIn} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-[15px] text-muted">{t('invite.signInFirst', { phone })}</p>
          <button className="h-[52px] rounded-control bg-accent text-[17px] font-semibold text-on-accent">
            {t('invite.continue')}
          </button>
        </form>
      ) : session.user.phone !== invitation.phone ? (
        <form action={signOut} className="flex flex-col gap-3">
          <p role="alert" className="rounded-[12px] bg-lock-bg px-4 py-3 text-[15px] text-lock-text">
            {t('invite.wrongPhone', { phone })}
          </p>
          <button className="h-12 rounded-control border border-border text-[16px] font-medium">
            {t('settings.signOut')}
          </button>
        </form>
      ) : (
        <form action={acceptInvitation} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <button className="h-[52px] rounded-control bg-accent text-[17px] font-semibold text-on-accent">
            {t('invite.accept')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
