'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, SecondaryButton, inputClass } from '@/components/form';
import { joinInviteWithPassword } from '@/features/team/actions';

/** For invitees without email while login codes go by email: the invitation link plus a password. */
export function InvitePasswordForm({ token }: { token: string }) {
  const t = useTranslations('invite');
  const [state, action, pending] = useActionState(joinInviteWithPassword, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <p className="text-[14px] text-muted">{t('noEmail')}</p>
      <Field id="invite-password" label={t('newPassword')}>
        <input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={!!state?.error}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      <FormError error={state?.error} />
      <SecondaryButton type="submit" pending={pending}>
        {t('joinWithPassword')}
      </SecondaryButton>
    </ActionForm>
  );
}
