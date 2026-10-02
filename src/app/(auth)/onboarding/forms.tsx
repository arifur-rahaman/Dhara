'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { acceptPrivacyNotice, createChamber } from '@/features/onboarding/actions';
import { districts } from '@/features/onboarding/districts';

export function ConsentForm() {
  const t = useTranslations('onboarding');
  const [state, action, pending] = useActionState(acceptPrivacyNotice, undefined);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-surface p-3.5">
        <input type="checkbox" name="agree" value="yes" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
        <span className="text-[15px] font-semibold">{t('agree')}</span>
      </label>
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending}>
        {t('nextStep')}
      </PrimaryButton>
    </ActionForm>
  );
}

export function ChamberForm({ defaultName }: { defaultName?: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createChamber, undefined);
  const v = state?.values;
  return (
    <ActionForm action={action} className="flex flex-1 flex-col gap-[22px]" noValidate>
      <div className="flex flex-col gap-3.5">
        <Field id="ob-chamber" label={t('onboarding.chamberName')}>
          <input
            id="ob-chamber"
            name="chamberName"
            required
            defaultValue={v?.chamberName}
            placeholder={t('onboarding.chamberNamePlaceholder')}
            className={`${inputClass} h-[50px] text-[16px]`}
          />
        </Field>
        <Field id="ob-name" label={t('onboarding.yourName')}>
          <input
            id="ob-name"
            name="yourName"
            required
            autoComplete="name"
            defaultValue={v?.yourName ?? defaultName}
            placeholder={t('onboarding.yourNamePlaceholder')}
            className={`${inputClass} h-[50px] text-[16px]`}
          />
        </Field>
        <Field id="ob-district" label={t('onboarding.district')}>
          <select
            id="ob-district"
            name="district"
            defaultValue={v?.district ?? 'Chattogram'}
            className={`${inputClass} h-[50px] text-[16px]`}
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {t(`districts.${d}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4">
        <span className="text-[14px] font-semibold">{t('onboarding.nextTitle')}</span>
        <span className="text-[14px] text-muted">{t('onboarding.next2')}</span>
        <span className="text-[14px] text-muted">{t('onboarding.next3')}</span>
      </div>
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-auto">
        {t('onboarding.nextStep')}
      </PrimaryButton>
    </ActionForm>
  );
}
