'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { createClient, saveClientContact } from './actions';

const field = `${inputClass} h-12 text-[16px] px-3.5`;

/**
 * New client, or the owner editing contact. Contact fields render only for the owner (P1);
 * the server checks again and ignores them for anyone else.
 */
export function ClientForm({
  mode,
  clientId,
  showContact,
  initial,
}: {
  mode: 'create' | 'edit';
  clientId?: string;
  showContact: boolean;
  initial?: {
    phone?: string | null;
    email?: string | null;
    nid?: string | null;
    address?: string | null;
    consent?: boolean;
  };
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(mode === 'create' ? createClient : saveClientContact, undefined);
  const v = state?.values;
  const val = (k: 'phone' | 'email' | 'nid' | 'address') => v?.[k] ?? initial?.[k] ?? '';

  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {mode === 'create' && (
        <Field id="client-name" label={t('client.name')}>
          <input
            id="client-name"
            name="name"
            required
            defaultValue={v?.name}
            placeholder={t('client.namePlaceholder')}
            className={field}
          />
        </Field>
      )}
      {showContact ? (
        <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <legend className="flex items-center gap-2 px-1 text-[15px] font-semibold">
            {t('client.contact')}
            <span className="rounded-full bg-ok-bg px-2.5 py-1 text-[12px] font-semibold text-ok">
              {t('client.onlyYou')}
            </span>
          </legend>
          <Field id="client-phone" label={t('client.phone')}>
            <input
              id="client-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={val('phone')}
              placeholder={t('client.phonePlaceholder')}
              className={field}
            />
          </Field>
          <Field id="client-email" label={t('client.email')}>
            <input id="client-email" name="email" type="email" defaultValue={val('email')} className={field} />
          </Field>
          <Field id="client-nid" label={t('client.nid')}>
            <input id="client-nid" name="nid" inputMode="numeric" defaultValue={val('nid')} className={field} />
          </Field>
          <Field id="client-address" label={t('client.address')}>
            <textarea
              id="client-address"
              name="address"
              rows={2}
              defaultValue={val('address')}
              className={`${inputClass} h-auto py-2.5 text-[15px]`}
            />
          </Field>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="consent"
              value="yes"
              defaultChecked={v ? v.consent === 'yes' : !!initial?.consent}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[14px]">{t('client.consent')}</span>
          </label>
        </fieldset>
      ) : (
        <p className="flex items-start gap-2 rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
          {t('client.contactOwnerOnly')}
        </p>
      )}
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-[50px] text-[16px]">
        {t('client.save')}
      </PrimaryButton>
    </ActionForm>
  );
}
