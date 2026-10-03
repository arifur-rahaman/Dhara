'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, FormError, PrimaryButton, inputClass } from '@/components/form';
import { setPassword } from './actions';

export function PasswordForm() {
  const t = useTranslations('settings');
  const [state, action, pending] = useActionState(setPassword, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-2 py-3">
      <label htmlFor="new-password" className="text-[14px] font-semibold">
        {t('newPassword')}
      </label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        aria-invalid={!!state?.error}
        className={`${inputClass} h-12 text-[16px]`}
      />
      <FormError error={state?.error} />
      {state?.saved && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('passwordSaved')}
        </p>
      )}
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('savePassword')}
      </PrimaryButton>
    </ActionForm>
  );
}
