'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, FormError, PrimaryButton, inputClass } from '@/components/form';
import { turnOffTwoStep } from '@/features/auth/two-step-actions';

/** Settings: turn two-step verification off, after a current code (or a recovery code). */
export function TwoStepOff() {
  const t = useTranslations('settings');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(turnOffTwoStep, undefined);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 px-2 text-[14px] font-semibold text-accent">
        {t('turnOff')}
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex w-full flex-col gap-2 py-3">
      <p className="text-[15px] font-semibold">{t('turnOffTitle')}</p>
      <label htmlFor="two-step-off-code" className="text-[14px] text-muted">
        {t('turnOffHint')}
      </label>
      <input
        id="two-step-off-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        aria-invalid={!!state?.error}
        className={`${inputClass} h-12 text-[16px]`}
      />
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('turnOffConfirm')}
      </PrimaryButton>
    </ActionForm>
  );
}
