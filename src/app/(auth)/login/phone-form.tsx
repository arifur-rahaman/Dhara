'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { sendOtp } from '@/features/auth/actions';

export function PhoneForm({ askEmail = false, showPassword = true }: { askEmail?: boolean; showPassword?: boolean }) {
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
      {(askEmail || state?.step === 'email') && (
        <Field id="login-email" label={t('email')} hint={<p className="text-[13px] text-muted">{t('emailHint')}</p>}>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus={!askEmail}
            defaultValue={state?.values?.email}
            aria-invalid={!!state?.error}
            className={inputClass}
          />
        </Field>
      )}
      <FormError id="login-error" error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('sendOtp')}
      </PrimaryButton>
      {showPassword && (
        <Link
          href="/login/password"
          className="flex h-12 items-center justify-center rounded-control border border-border text-[16px] font-medium"
        >
          {t('withPassword')}
        </Link>
      )}
    </ActionForm>
  );
}
