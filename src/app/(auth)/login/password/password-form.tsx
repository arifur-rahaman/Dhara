'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { signInWithPassword } from '@/features/auth/actions';

export function PasswordForm() {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState(signInWithPassword, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="pw-phone" label={t('phone')}>
        <input
          id="pw-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          defaultValue={state?.values?.phone}
          placeholder={t('phonePlaceholder')}
          className={inputClass}
        />
      </Field>
      <Field id="pw-password" label={t('password')}>
        <input
          id="pw-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? 'pw-error' : undefined}
          className={inputClass}
        />
      </Field>
      <FormError id="pw-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('signIn')}
      </PrimaryButton>
      <Link
        href="/login"
        className="flex h-12 items-center justify-center rounded-control border border-border text-[16px] font-medium"
      >
        {t('useOtp')}
      </Link>
    </ActionForm>
  );
}
