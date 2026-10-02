'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { twoStepSetupAction, type TwoStepSetupState } from '@/features/auth/two-step-actions';

const initial: TwoStepSetupState = { step: 'start' };

export function TwoStepSetup() {
  const t = useTranslations('twoStep');
  const [state, action] = useActionState(twoStepSetupAction, initial);

  if (state.step === 'start') {
    return (
      <form action={action}>
        <input type="hidden" name="intent" value="start" />
        <PrimaryButton type="submit" className="w-full">
          {t('start')}
        </PrimaryButton>
      </form>
    );
  }

  if (state.step === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-[18px] font-semibold" role="status">
          {t('doneTitle')}
        </h2>
        <p className="text-[15px] text-muted">{t('recoveryBody')}</p>
        <ul
          className="grid grid-cols-2 gap-2 rounded-card border border-border bg-surface p-4 font-mono text-[16px]"
          lang="en"
        >
          {state.recoveryCodes.map((code) => (
            <li key={code} data-testid="recovery-code">
              {code}
            </li>
          ))}
        </ul>
        <Link
          href="/today"
          className="flex h-[52px] items-center justify-center rounded-control bg-accent text-[17px] font-semibold text-on-accent"
        >
          {t('saved')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px]">{t('scan')}</p>
      <div
        className="mx-auto w-[200px] rounded-[12px] bg-white p-2"
        role="img"
        aria-label="QR"
        // SVG made on the server by the qrcode library from the otpauth URI; it contains no user input.
        dangerouslySetInnerHTML={{ __html: state.qrSvg }}
      />
      <a href={state.uri} className="self-center text-[14px] font-semibold text-accent">
        {t('openApp')}
      </a>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">{t('manual')}</span>
        <code
          data-testid="totp-secret"
          lang="en"
          className="rounded-[10px] bg-surface-2 px-3 py-2 text-[15px] break-all"
        >
          {state.secret}
        </code>
      </div>
      <form action={action} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="intent" value="confirm" />
        <Field id="totp-setup-code" label={t('code')}>
          <input
            id="totp-setup-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            aria-invalid={!!state.error}
            className={`${inputClass} text-center text-[22px] tracking-[0.3em]`}
          />
        </Field>
        <FormError error={state.error} />
        <PrimaryButton type="submit">{t('confirm')}</PrimaryButton>
      </form>
    </div>
  );
}
