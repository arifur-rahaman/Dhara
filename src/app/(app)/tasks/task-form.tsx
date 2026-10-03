'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { createTask } from '@/features/tasks/actions';

/** Owner's "give a task" form (P11). Clears itself after each saved task. */
export function TaskForm({ assignees }: { assignees: { id: string; label: string }[] }) {
  const t = useTranslations('tasks');
  const [state, action, pending] = useActionState(createTask, undefined);
  const v = state?.ok ? undefined : state?.values;
  return (
    <ActionForm
      key={state?.at ?? 0}
      action={action}
      aria-labelledby="task-form-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
      noValidate
    >
      <h2 id="task-form-title" className="text-[16px] font-semibold">
        {t('newTitle')}
      </h2>
      <Field id="task-title" label={t('title')}>
        <input
          id="task-title"
          name="title"
          required
          defaultValue={v?.title}
          placeholder={t('titlePlaceholder')}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="task-assignee" label={t('assignee')}>
          <select
            id="task-assignee"
            name="assignee"
            defaultValue={v?.assignee ?? assignees[0]?.id}
            className={`${inputClass} h-12 text-[16px]`}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="task-due" label={t('dueLabel')}>
          <input
            id="task-due"
            name="dueOn"
            type="date"
            defaultValue={v?.dueOn}
            className={`${inputClass} h-12 text-[16px]`}
          />
        </Field>
      </div>
      {state?.ok && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('added')}
        </p>
      )}
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="h-12 text-[16px]">
        {t('add')}
      </PrimaryButton>
    </ActionForm>
  );
}
