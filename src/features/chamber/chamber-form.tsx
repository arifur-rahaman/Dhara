'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { saveChamberDetails } from './actions';

export function ChamberForm({ name, address }: { name: string; address: string }) {
  const t = useTranslations('settings');
  const [state, action, pending] = useActionState(saveChamberDetails, undefined);
  const v = state?.values ?? { name, address };
  return (
    <ActionForm action={action} className="flex flex-col gap-3 py-3" noValidate>
      <Field id="chamber-name" label={t('chamberName')}>
        <input
          id="chamber-name"
          name="name"
          required
          defaultValue={v.name}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      <Field
        id="chamber-address"
        label={t('chamberAddress')}
        hint={<span className="text-[13px] text-muted">{t('chamberAddressHint')}</span>}
      >
        <input
          id="chamber-address"
          name="address"
          defaultValue={v.address}
          maxLength={200}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      {state?.ok && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('chamberSaved')}
        </p>
      )}
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('chamberSave')}
      </PrimaryButton>
    </ActionForm>
  );
}
