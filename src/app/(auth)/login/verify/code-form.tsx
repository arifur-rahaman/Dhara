'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { verifyCode } from '@/features/auth/actions';

export function CodeForm({ challenge }: { challenge: string }) {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState(verifyCode, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="challenge" value={challenge} />
      <Field id="otp-code" label={t('code')}>
        <input
          id="otp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? 'otp-error' : undefined}
          className={`${inputClass} text-center text-[24px] tracking-[0.4em]`}
        />
      </Field>
      <FormError id="otp-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('signIn')}
      </PrimaryButton>
    </ActionForm>
  );
}
