'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { verifyTwoStep } from '@/features/auth/actions';

export function TwoStepForm() {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState(verifyTwoStep, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="totp-code" label={t('code')}>
        <input
          id="totp-code"
          name="code"
          autoComplete="one-time-code"
          required
          autoFocus
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? 'totp-error' : undefined}
          className={`${inputClass} text-center text-[22px] tracking-[0.3em]`}
        />
      </Field>
      <FormError id="totp-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('continue')}
      </PrimaryButton>
    </ActionForm>
  );
}
