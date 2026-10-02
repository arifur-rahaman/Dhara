import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { getSession } from '@/server/auth/session';
import { roles } from '@/features/shell/nav';
import { afterSignInPath } from '@/features/auth/after-sign-in';
import { AuthShell } from '../auth-shell';
import { PhoneForm } from './phone-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('login');
  return { title: t('title') };
}

/** Login (docs/design/MainEnglish.dc.html, Main.dc.html). One login for every chamber role. */
export default async function LoginPage() {
  const session = await getSession();
  if (session?.mfaVerifiedAt) redirect(await afterSignInPath());
  const t = await getTranslations();

  return (
    <AuthShell>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-title text-[34px] leading-[1.25] font-normal">{t('login.title')}</h1>
        <p className="text-[16px] text-muted">{t('login.subtitle')}</p>
      </div>

      <PhoneForm />

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-[18px]">
        <h2 className="text-[15px] font-semibold">{t('login.noRoleTitle')}</h2>
        <p className="text-[14px] text-muted">{t('login.noRoleBody')}</p>
        <ul className="flex flex-wrap gap-2">
          {roles.map((role, i) => (
            <li
              key={role}
              className={`rounded-full px-3 py-1.5 text-[13px] ${
                i === 0 ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2 font-medium'
              }`}
            >
              {t(`roles.${role}`)}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-auto flex items-start gap-2 text-[13px] text-muted">
        <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
        <span>{t('login.security')}</span>
      </p>
    </AuthShell>
  );
}
