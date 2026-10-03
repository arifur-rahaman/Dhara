'use client';

import { useActionState, useState } from 'react';
import { useFormatter, useTranslations, type DateTimeFormatOptions } from 'next-intl';
import { ActionForm, FormError, PrimaryButton, inputClass } from '@/components/form';
import { Icon } from '@/components/icons';
import { addDays, addMonths, dbDate, monthGrid, type Ymd } from '@/lib/dates';
import { addNextDate } from '@/features/cases/actions';

/** NextDate design: quick choices, a month calendar, what happened today, then save. */
export function NextDateForm({ caseId, today }: { caseId: string; today: Ymd }) {
  const t = useTranslations('nextDate');
  const format = useFormatter();
  const [state, action, pending] = useActionState(addNextDate, undefined);
  const quick = [
    { key: 'in7', date: addDays(today, 7) },
    { key: 'in14', date: addDays(today, 14) },
    { key: 'in1m', date: addMonths(today, 1) },
  ] as const;
  const [selected, setSelected] = useState<Ymd | null>(state?.values?.date ?? null);
  const initial = dbDate(selected ?? today);
  const [view, setView] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() + 1 });
  const isQuick = quick.some((q) => q.date === selected);

  const pick = (date: Ymd) => {
    setSelected(date);
    const d = dbDate(date);
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };
  const move = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };
  const fmt = (ymd: Ymd, opts: DateTimeFormatOptions) => format.dateTime(dbDate(ymd), opts);
  const weekdays = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];

  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="date" value={selected ?? ''} />

      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t('pick')}>
        {quick.map((q) => (
          <button
            key={q.key}
            type="button"
            aria-pressed={selected === q.date}
            onClick={() => pick(q.date)}
            className="h-11 rounded-[10px] border border-border bg-surface text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
          >
            {t(q.key)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!!selected && !isQuick}
          onClick={() => document.getElementById('nd-calendar')?.focus()}
          className="h-11 rounded-[10px] border border-border bg-surface text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
        >
          {t('other')}
        </button>
      </div>

      <div
        id="nd-calendar"
        tabIndex={-1}
        className="flex flex-col gap-1.5 rounded-[14px] border border-border px-3 pt-2.5 pb-3"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={t('prevMonth')}
            onClick={() => move(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="back" size={18} />
          </button>
          <span className="text-[15px] font-semibold" aria-live="polite">
            {format.dateTime(new Date(Date.UTC(view.year, view.month - 1, 15)), { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            aria-label={t('nextMonth')}
            onClick={() => move(1)}
            className="flex h-11 w-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
        <table className="w-full table-fixed border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} scope="col" className="text-[12px] font-semibold text-muted">
                  {fmt(w, { weekday: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(view.year, view.month).map((week, i) => (
              <tr key={i}>
                {week.map((day, j) => (
                  <td key={j}>
                    {day && (
                      <button
                        type="button"
                        disabled={day < today}
                        aria-pressed={day === selected}
                        aria-label={fmt(day, { day: 'numeric', month: 'long', year: 'numeric' })}
                        onClick={() => pick(day)}
                        className={`h-11 w-full rounded-full text-[14px] disabled:text-muted/50 ${
                          day === selected
                            ? 'bg-accent font-bold text-on-accent'
                            : day === today
                              ? 'font-semibold underline'
                              : ''
                        }`}
                      >
                        {fmt(day, { day: 'numeric' })}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nd-note" className="text-[14px] font-semibold">
          {t('whatHappened')}
        </label>
        <textarea
          id="nd-note"
          name="note"
          rows={2}
          defaultValue={state?.values?.note}
          placeholder={t('whatHappenedPlaceholder')}
          className={`${inputClass} h-auto bg-bg py-2.5 text-[15px]`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nd-serial" className="text-[14px] font-semibold">
          {t('serial')}
        </label>
        <input
          id="nd-serial"
          name="serial"
          defaultValue={state?.values?.serial}
          className={`${inputClass} h-12 bg-bg text-[16px]`}
        />
      </div>

      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} disabled={!selected} className="mt-1 h-[50px] text-[16px]">
        {selected ? t('save', { date: fmt(selected, { day: 'numeric', month: 'long' }) }) : t('pick')}
      </PrimaryButton>
    </ActionForm>
  );
}
