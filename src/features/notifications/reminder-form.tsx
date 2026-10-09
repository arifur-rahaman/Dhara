'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, FormError, PrimaryButton, inputClass } from '@/components/form';
import { saveReminderPrefs } from './actions';

/** Night and morning reminder rows (Settings design): a switch and a time each. */
export function ReminderForm({
  initial,
}: {
  initial: { nightOn: boolean; nightAt: string; morningOn: boolean; morningAt: string };
}) {
  const t = useTranslations('reminders');
  const [state, action, pending] = useActionState(saveReminderPrefs, undefined);
  const row = (kind: 'night' | 'morning', on: boolean, at: string) => (
    <div className="flex min-h-[60px] items-center justify-between gap-3 border-t border-border first:border-t-0">
      <label className="flex min-h-11 grow cursor-pointer items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          role="switch"
          name={`${kind}On`}
          defaultChecked={on}
          className="size-5 shrink-0 accent-[var(--accent)]"
        />
        {t(kind)}
      </label>
      <label className="sr-only" htmlFor={`${kind}-at`}>
        {t(kind)} · {t('at')}
      </label>
      <input
        id={`${kind}-at`}
        name={`${kind}At`}
        type="time"
        step={60}
        required
        defaultValue={state?.values?.[`${kind}At`] ?? at}
        className={`${inputClass} h-11 w-[132px] text-[15px]`}
      />
    </div>
  );
  return (
    <ActionForm action={action} className="flex flex-col pb-3" noValidate>
      {row('night', initial.nightOn, initial.nightAt)}
      {row('morning', initial.morningOn, initial.morningAt)}
      {state?.ok && (
        <p role="status" className="mb-2 rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('saved')}
        </p>
      )}
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('save')}
      </PrimaryButton>
    </ActionForm>
  );
}
