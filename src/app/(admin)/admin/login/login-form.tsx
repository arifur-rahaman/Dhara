'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { adminSignIn } from '@/features/admin-portal/actions';

export function AdminLoginForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(adminSignIn, undefined);
  const invalid = !!state?.error;
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="adm-phone" label={t('login.phone')}>
        <input
          id="adm-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          defaultValue={state?.values?.phone}
          placeholder={t('login.phonePlaceholder')}
          className={inputClass}
        />
      </Field>
      <Field id="adm-password" label={t('login.password')}>
        <input
          id="adm-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? 'adm-error' : undefined}
          className={inputClass}
        />
      </Field>
      <Field id="adm-code" label={t('admin.login.code')}>
        <input
          id="adm-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? 'adm-error' : undefined}
          className={`${inputClass} tracking-[0.3em]`}
        />
      </Field>
      <FormError id="adm-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('login.signIn')}
      </PrimaryButton>
    </ActionForm>
  );
}
