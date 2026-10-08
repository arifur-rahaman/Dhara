'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { Icon } from '@/components/icons';
import { addFee, dueReminderLink, receiptShareLink, recordPayment } from './actions';

const control = `${inputClass} h-12 text-[16px]`;

export function PaymentForm({
  cases,
  defaultCaseId,
  today,
}: {
  cases: { id: string; label: string }[];
  defaultCaseId?: string;
  today: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const v = state?.values;
  const [method, setMethod] = useState(v?.method ?? 'cash');
  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="pay-case" label={t('money.case')}>
        <select id="pay-case" name="caseId" defaultValue={v?.caseId ?? defaultCaseId} className={control}>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pay-amount" label={t('money.amount')}>
        <input
          id="pay-amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={v?.amount}
          placeholder="5000"
          className={control}
        />
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[14px] font-semibold">{t('money.method')}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-2 p-1 sm:grid-cols-4">
          {(['cash', 'bkash', 'nagad', 'bank'] as const).map((m) => (
            <label
              key={m}
              className="flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="sr-only"
              />
              {t(`money.methods.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {method !== 'cash' && (
        <Field id="pay-ref" label={method === 'bank' ? t('money.referenceOptional') : t('money.reference')}>
          <input id="pay-ref" name="reference" defaultValue={v?.reference} maxLength={60} className={control} />
        </Field>
      )}
      <Field id="pay-for" label={t('money.for')}>
        <input
          id="pay-for"
          name="description"
          required
          defaultValue={v?.description ?? t('money.defaultFor')}
          maxLength={120}
          className={control}
        />
      </Field>
      <Field id="pay-date" label={t('money.paidOn')}>
        <input
          id="pay-date"
          name="paidOn"
          type="date"
          max={today}
          defaultValue={v?.paidOn ?? today}
          className={control}
        />
      </Field>
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1">
        {t('money.saveAndReceipt')}
      </PrimaryButton>
    </ActionForm>
  );
}

export function FeeForm({ caseId, today }: { caseId: string; today: string }) {
  const t = useTranslations('money');
  const [state, action, pending] = useActionState(addFee, undefined);
  const v = state?.ok ? undefined : state?.values;
  return (
    <ActionForm
      key={state?.at ?? 0}
      action={action}
      aria-labelledby="fee-form"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
      noValidate
    >
      <h3 id="fee-form" className="text-[15px] font-semibold">
        {t('addFee')}
      </h3>
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field id="fee-desc" label={t('feeFor')}>
          <input
            id="fee-desc"
            name="description"
            required
            defaultValue={v?.description}
            placeholder={t('feePlaceholder')}
            className={control}
          />
        </Field>
        <Field id="fee-amount" label={t('amount')}>
          <input
            id="fee-amount"
            name="amount"
            inputMode="decimal"
            required
            defaultValue={v?.amount}
            className={control}
          />
        </Field>
      </div>
      <input type="hidden" name="chargedOn" value={today} />
      {state?.ok && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('feeAdded')}
        </p>
      )}
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('addFee')}
      </PrimaryButton>
    </ActionForm>
  );
}

/** The bell-style "remind" button on a due row: opens the owner's SMS or WhatsApp with a prefilled message. */
export function RemindButton({ caseId, label }: { caseId: string; label: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const go = async (channel: 'sms' | 'whatsapp') => {
    setError(undefined);
    const res = await dueReminderLink(caseId, channel);
    if ('error' in res) return setError(res.error);
    setOpen(false);
    window.location.href = res.url;
  };
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full border border-border"
      >
        <Icon name="notifications" size={20} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-[12px] border border-border bg-surface p-2 shadow-lg">
          <button type="button" onClick={() => go('sms')} className="flex h-11 items-center px-2 text-left text-[15px]">
            {t('money.remindSms')}
          </button>
          <button
            type="button"
            onClick={() => go('whatsapp')}
            className="flex h-11 items-center px-2 text-left text-[15px]"
          >
            {t('money.remindWhatsApp')}
          </button>
          {error && (
            <p role="alert" className="px-2 py-1 text-[13px] text-lock-text">
              {t(`errors.${error}`)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ReceiptWhatsAppButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const res = await receiptShareLink(paymentId);
          if ('error' in res) return setError(res.error);
          window.location.href = res.url;
        }}
        className="h-[46px] rounded-control border border-border text-[15px] font-medium"
      >
        {t('receipt.whatsapp')}
      </button>
      {error && (
        <p role="alert" className="text-[13px] text-lock-text">
          {t(`errors.${error}`)}
        </p>
      )}
    </>
  );
}
