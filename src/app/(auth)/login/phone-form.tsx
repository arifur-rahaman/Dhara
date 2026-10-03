'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { sendOtp } from '@/features/auth/actions';

export function PhoneForm() {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState(sendOtp, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="login-phone" label={t('phone')}>
        <input
          id="login-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          defaultValue={state?.values?.phone}
          placeholder={t('phonePlaceholder')}
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? 'login-error' : undefined}
          className={inputClass}
        />
      </Field>
      <FormError id="login-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('sendOtp')}
      </PrimaryButton>
      <Link
        href="/login/password"
        className="flex h-12 items-center justify-center rounded-control border border-border text-[16px] font-medium"
      >
        {t('withPassword')}
      </Link>
    </ActionForm>
  );
}
