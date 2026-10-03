'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { recordPayment, requestSupport, setChamberPlan } from './actions';
import { chamberStatuses, plans } from './plans';

const box = 'flex flex-col gap-3 rounded-card border border-border bg-surface p-5';
const control = `${inputClass} h-11 text-[15px]`;

function Saved({ show, text }: { show?: boolean; text: string }) {
  if (!show) return null;
  return (
    <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
      {text}
    </p>
  );
}

export function PlanForm({
  chamberId,
  current,
}: {
  chamberId: string;
  current: { plan: string; status: string; trialEndsAt: string };
}) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(setChamberPlan, undefined);
  const v = state?.values ?? current;
  return (
    <ActionForm key={state?.at ?? 0} action={action} className={box} aria-labelledby="plan-form" noValidate>
      <h2 id="plan-form" className="text-[16px] font-semibold">
        {t('chamber.planTitle')}
      </h2>
      <input type="hidden" name="chamberId" value={chamberId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="plan" label={t('chamber.plan')}>
          <select id="plan" name="plan" defaultValue={v.plan} className={control}>
            {plans.map((p) => (
              <option key={p} value={p}>
                {t(`plans.${p}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="status" label={t('chamber.status')}>
          <select id="status" name="status" defaultValue={v.status} className={control}>
            {chamberStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="trial" label={t('chamber.trialEnds')}>
          <input id="trial" name="trialEndsAt" type="date" defaultValue={v.trialEndsAt} className={control} />
        </Field>
      </div>
      <Saved show={state?.ok} text={t('chamber.saved')} />
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-11 self-start px-5 text-[15px]">
        {t('chamber.savePlan')}
      </PrimaryButton>
    </ActionForm>
  );
}

export function PaymentForm({ chamberId, today }: { chamberId: string; today: string }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const v = state?.ok ? undefined : state?.values;
  return (
    <ActionForm key={state?.at ?? 0} action={action} className={box} aria-labelledby="payment-form" noValidate>
      <h2 id="payment-form" className="text-[16px] font-semibold">
        {t('payments.recordTitle')}
      </h2>
      <input type="hidden" name="chamberId" value={chamberId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="amount" label={t('payments.amount')}>
          <input id="amount" name="amount" inputMode="decimal" required defaultValue={v?.amount} className={control} />
        </Field>
        <Field id="method" label={t('payments.method')}>
          <select id="method" name="method" defaultValue={v?.method ?? 'bkash'} className={control}>
            {(['bkash', 'nagad', 'bank', 'cash', 'other'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`payments.methods.${m}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="reference" label={t('payments.reference')}>
          <input id="reference" name="reference" defaultValue={v?.reference} className={control} />
        </Field>
        <Field id="paidOn" label={t('payments.paidOn')}>
          <input id="paidOn" name="paidOn" type="date" required defaultValue={v?.paidOn ?? today} className={control} />
        </Field>
      </div>
      <Saved show={state?.ok} text={t('payments.saved')} />
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-11 self-start px-5 text-[15px]">
        {t('payments.record')}
      </PrimaryButton>
    </ActionForm>
  );
}

export function SupportRequestForm({ chamberId }: { chamberId: string }) {
  const t = useTranslations('admin.support');
  const [state, action, pending] = useActionState(requestSupport, undefined);
  const v = state?.ok ? undefined : state?.values;
  return (
    <ActionForm key={state?.at ?? 0} action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="chamberId" value={chamberId} />
      <Field id="reason" label={t('reason')} hint={<span className="text-[13px] text-muted">{t('reasonHint')}</span>}>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={1000}
          rows={3}
          defaultValue={v?.reason}
          className={`${inputClass} h-auto py-3 text-[15px]`}
        />
      </Field>
      <Saved show={state?.ok} text={t('sent')} />
      <FormError error={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-[10px] border border-border text-[15px] font-semibold disabled:opacity-60"
      >
        {t('send')}
      </button>
    </ActionForm>
  );
}
