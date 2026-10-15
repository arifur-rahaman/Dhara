import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/server/auth/session';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { CalendarSettings } from '@/features/calendar-sync/calendar-settings';
import { setAiPhotoReading } from '@/features/chamber/actions';
import { ChamberForm } from '@/features/chamber/chamber-form';
import { PushSetup, SignOutButton } from '@/features/notifications/push-setup';
import { ReminderForm } from '@/features/notifications/reminder-form';
import { env } from '@/server/env';
import { signOut } from '@/features/auth/actions';
import { PasswordForm } from '@/features/account/password-form';
import { TwoStepOff } from '@/features/account/two-step-off';
import { getPreferences } from '@/features/preferences/server';
import {
  LanguageSetting,
  NumeralsSetting,
  TextSizeSetting,
  ThemeSetting,
} from '@/features/preferences/settings-controls';
import { activeSessions } from '@/server/auth/session';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

/**
 * Settings (docs/design/Settings.dc.html): Display (M0) and Security & account (M1).
 * Reminders (M5), chamber details (M4), font size and login devices (M6).
 */
export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  const { locale, numerals } = await getPreferences();
  const t = await getTranslations('settings');
  const tr = await getTranslations('reminders');
  // Pages render alongside the layout, so each page checks the session itself.
  const ctx = await requireCtx();
  const user = (await getSession())!.user;
  const deviceCount = (await activeSessions(user.id)).length;
  const chamber = can.editChamberSettings(ctx)
    ? await withTenant(scopeOf(ctx), (tx) =>
        tx.chamber.findUniqueOrThrow({
          where: { id: ctx.chamberId },
          select: { name: true, address: true, aiPhotoReading: true },
        }),
      )
    : null;

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('title')} />
      <section aria-labelledby="settings-display" className="flex flex-col gap-1.5">
        <h2 id="settings-display" className="px-1 text-[13px] font-semibold text-muted">
          {t('display')}
        </h2>
        <div className="flex flex-col rounded-card border border-border bg-surface px-4 py-1">
          <LanguageSetting current={locale} />
          <ThemeSetting />
          <TextSizeSetting current={user.textSize === 'sm' || user.textSize === 'lg' ? user.textSize : 'md'} />
          {locale === 'bn' && <NumeralsSetting current={numerals} />}
        </div>
      </section>

      <section aria-labelledby="settings-reminders" className="flex flex-col gap-1.5">
        <h2 id="settings-reminders" className="px-1 text-[13px] font-semibold text-muted">
          {tr('title')}
        </h2>
        <div className="rounded-card border border-border bg-surface px-4">
          <ReminderForm
            initial={{
              nightOn: user.reminderNightOn,
              nightAt: user.reminderNightAt,
              morningOn: user.reminderMorningOn,
              morningAt: user.reminderMorningAt,
            }}
          />
          <div className="border-t border-border">
            <p className="pt-3 text-[13px] font-semibold text-muted">{tr('device')}</p>
            <PushSetup publicKey={env().VAPID_PUBLIC_KEY || null} />
          </div>
          <p className="border-t border-border py-3 text-[13px] leading-relaxed text-muted">{tr('privacy')}</p>
        </div>
      </section>

      <CalendarSettings
        ctx={ctx}
        status={typeof (await searchParams).calendar === 'string' ? String((await searchParams).calendar) : undefined}
      />

      {chamber && (
        <section aria-labelledby="settings-chamber" className="flex flex-col gap-1.5">
          <h2 id="settings-chamber" className="px-1 text-[13px] font-semibold text-muted">
            {t('chamber')}
          </h2>
          <div className="rounded-card border border-border bg-surface px-4">
            <ChamberForm name={chamber.name} address={chamber.address ?? ''} />
          </div>
        </section>
      )}

      {chamber && (
        <section id="settings-ai" aria-labelledby="settings-ai-title" className="flex scroll-mt-4 flex-col gap-1.5">
          <h2 id="settings-ai-title" className="px-1 text-[13px] font-semibold text-muted">
            {t('aiTitle')}
          </h2>
          <form
            action={setAiPhotoReading}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <input type="hidden" name="on" value={chamber.aiPhotoReading ? '0' : '1'} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{t('aiPhoto')}</span>
              <span
                className={`rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${chamber.aiPhotoReading ? 'bg-ok-bg text-ok' : 'bg-surface-2 text-muted'}`}
              >
                {chamber.aiPhotoReading ? t('on') : t('off')}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">{t('aiPhotoNote')}</p>
            <button
              type="submit"
              className="h-11 self-start rounded-control border border-border px-4 text-[14px] font-semibold"
            >
              {chamber.aiPhotoReading ? t('aiPhotoTurnOff') : t('aiPhotoTurnOn')}
            </button>
          </form>
        </section>
      )}

      <section aria-labelledby="settings-security" className="flex flex-col gap-1.5">
        <h2 id="settings-security" className="px-1 text-[13px] font-semibold text-muted">
          {t('security')}
        </h2>
        <div className="flex flex-col rounded-card border border-border bg-surface px-4">
          <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 text-[15px]">
                {t('twoStep')}
                {user.totpEnabledAt && (
                  <span className="rounded-full bg-ok-bg px-2.5 py-[3px] text-[12px] font-semibold text-ok">
                    {t('on')}
                  </span>
                )}
              </span>
              {!user.totpEnabledAt && <span className="text-[13px] text-muted">{t('twoStepOptional')}</span>}
            </div>
            {user.totpEnabledAt ? (
              <TwoStepOff />
            ) : (
              <Link href="/security/two-step" className="text-[14px] font-semibold text-accent">
                {t('turnOn')}
              </Link>
            )}
          </div>
          <Link
            href="/settings/devices"
            className="flex min-h-[52px] items-center justify-between gap-3 border-t border-border"
          >
            <span className="text-[15px]">{t('devices')}</span>
            <span className="text-[14px] text-muted">{t('deviceCount', { count: deviceCount })}</span>
          </Link>
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-border">
            <span className="text-[15px]">{t('password')}</span>
            <span className="text-[14px] text-muted">{user.passwordHash ? t('passwordSet') : t('passwordNotSet')}</span>
          </div>
          <div className="border-t border-border">
            <PasswordForm />
          </div>
          <div className="border-t border-border">
            <SignOutButton
              action={signOut}
              label={t('signOut')}
              className="flex min-h-[52px] w-full items-center text-[15px] font-semibold text-lock-text"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
