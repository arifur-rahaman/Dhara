'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';
import { inputClass } from '@/components/form';
import { compressPhoto } from '@/features/documents/upload';
import { OUTBOX_EVENT, notifyOutboxChanged, outboxAdd, outboxAll, readSnapshot } from './idb';
import { flushOutbox } from './sync';
import type { OfflineHearing, OfflineSnapshot, OutboxItem } from './types';

const plusDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Saved day view for working without signal: today's list, quick next dates and order photos, own tasks. */
export function OfflineView() {
  const t = useTranslations('offline');
  const format = useFormatter();
  const [snap, setSnap] = useState<OfflineSnapshot | null | undefined>(undefined);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    const load = () => {
      readSnapshot()
        .then((s) => setSnap(s ?? null))
        .catch(() => setSnap(null));
      outboxAll()
        .then(setOutbox)
        .catch(() => setOutbox([]));
    };
    load();
    window.addEventListener(OUTBOX_EVENT, load);
    return () => window.removeEventListener(OUTBOX_EVENT, load);
  }, []);

  const queue = async (item: OutboxItem) => {
    await outboxAdd(item);
    notifyOutboxChanged();
    setOpen(null);
    if (navigator.onLine) void flushOutbox().catch(() => {});
  };

  if (snap === undefined) return null;
  if (snap === null) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="page-title">{t('title')}</h1>
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('nothingSaved')}</p>
      </div>
    );
  }

  const synced = format.dateTime(new Date(snap.generatedAt), { hour: 'numeric', minute: '2-digit' });
  const pendingFor = (caseId: string) => outbox.filter((o) => 'caseId' in o.payload && o.payload.caseId === caseId);

  const row = (h: OfflineHearing) => (
    <li key={h.hearingId} className="border-t border-border first:border-t-0">
      <div className="flex min-h-[68px] items-center gap-3 py-2">
        <span className="w-[68px] shrink-0 rounded-[8px] bg-accent-soft py-1 text-center text-[12px] font-semibold text-accent">
          {h.serial ?? '—'}
        </span>
        <div className="flex min-w-0 grow flex-col gap-px">
          <span className="text-[15px] font-semibold">{h.title}</span>
          <span className="text-[13px] text-muted">{h.court}</span>
          {h.party && <span className="text-[13px] text-muted">{h.party}</span>}
          {pendingFor(h.caseId).length > 0 && (
            <span className="text-[12px] font-semibold text-lock-text">
              {t('pendingHere', { count: pendingFor(h.caseId).length })}
            </span>
          )}
        </div>
        {h.canAddHearing && (
          <button
            type="button"
            aria-expanded={open === h.hearingId}
            aria-label={t('actionsFor', { title: h.title })}
            onClick={() => setOpen(open === h.hearingId ? null : h.hearingId)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <Icon name="calendar" size={20} />
          </button>
        )}
      </div>
      {open === h.hearingId && (
        <QuickActions hearing={h} today={snap.today.date} canPhoto={snap.canUploadOrders} onQueue={queue} />
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div role="status" className="flex items-center gap-2.5 rounded-[12px] bg-lock-bg px-3.5 py-2.5">
        <Icon name="close" size={18} className="shrink-0 text-lock-text" />
        <span className="flex flex-col gap-px">
          <span className="text-[14px] font-semibold">{online ? t('savedView') : t('banner')}</span>
          <span className="text-[12px] text-muted">{t('lastSync', { time: synced })}</span>
        </span>
      </div>
      <header className="flex flex-col gap-1">
        <span className="text-[14px] text-muted">{snap.today.label}</span>
        <h1 className="page-title">{t('todayTitle')}</h1>
      </header>

      {snap.today.hearings.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('noHearings')}</p>
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
          {snap.today.hearings.map(row)}
        </ul>
      )}

      {outbox.length > 0 && (
        <section
          aria-labelledby="pending-changes"
          className="flex items-start gap-3 rounded-card border border-dashed border-border bg-surface px-4 py-3.5"
        >
          <Icon name="clock" size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="flex flex-col gap-1">
            <h2 id="pending-changes" className="text-[14px] font-semibold">
              {t('pending', { count: outbox.length })}
            </h2>
            <p className="text-[13px] leading-normal text-muted">{t('pendingNote')}</p>
            <ul className="flex flex-col gap-0.5 pt-1 text-[13px]">
              {outbox.map((o) => (
                <li key={o.key}>{o.label}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {snap.tasks.length > 0 && (
        <section aria-labelledby="offline-tasks" className="flex flex-col gap-2">
          <h2 id="offline-tasks" className="text-[16px] font-semibold">
            {t('tasks')}
          </h2>
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {snap.tasks.map((task) => {
              const queued = outbox.some((o) => o.kind === 'taskDone' && o.payload.taskId === task.id);
              return (
                <li
                  key={task.id}
                  className="flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0"
                >
                  <button
                    type="button"
                    disabled={queued}
                    aria-label={t('markDone', { title: task.title })}
                    onClick={() =>
                      queue({
                        key: crypto.randomUUID(),
                        kind: 'taskDone',
                        createdAt: new Date().toISOString(),
                        label: t('labelTask', { title: task.title }),
                        payload: { taskId: task.id },
                      })
                    }
                    className="-m-2.5 flex size-11 items-center justify-center"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-[7px] border-2 ${queued ? 'border-accent bg-accent text-on-accent' : 'border-border'}`}
                    >
                      {queued && <Icon name="check" size={16} />}
                    </span>
                  </button>
                  <span className={`grow text-[15px] ${queued ? 'text-muted line-through' : ''}`}>{task.title}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {snap.tomorrow.hearings.length > 0 && (
        <section aria-labelledby="offline-tomorrow" className="flex flex-col gap-2">
          <h2 id="offline-tomorrow" className="text-[16px] font-semibold">
            {t('tomorrow', { day: snap.tomorrow.label })}
          </h2>
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {snap.tomorrow.hearings.map((h) => (
              <li
                key={h.hearingId}
                className="flex min-h-14 flex-col justify-center gap-px border-t border-border py-2 first:border-t-0"
              >
                <span className="text-[15px] font-semibold">{h.title}</span>
                <span className="text-[13px] text-muted">{h.court}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snap.cases.length > 0 && (
        <details className="rounded-card border border-border bg-surface px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-semibold">
            {t('recentCases', { count: snap.cases.length })}
          </summary>
          <ul className="flex flex-col pb-2">
            {snap.cases.map((c) => (
              <li key={c.id} className="flex flex-col gap-px border-t border-border py-2">
                <span className="text-[15px] font-semibold">{c.title}</span>
                <span className="text-[13px] text-muted">
                  {c.court}
                  {c.next && ` · ${t('next', { date: c.next })}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function QuickActions({
  hearing,
  today,
  canPhoto,
  onQueue,
}: {
  hearing: OfflineHearing;
  today: string;
  canPhoto: boolean;
  onQueue: (item: OutboxItem) => Promise<void>;
}) {
  const t = useTranslations('offline');
  const format = useFormatter();
  const day = (ymd: string) =>
    format.dateTime(new Date(`${ymd}T00:00:00Z`), { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = hearing.hearingId;
  return (
    <div className="flex flex-col gap-2.5 pb-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-[14px] font-semibold">{t('nextDate')}</legend>
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={date === plusDays(today, n)}
              onClick={() => setDate(plusDays(today, n))}
              className="h-10 rounded-full border border-border px-3.5 text-[14px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold"
            >
              {t('inDays', { count: n })}
            </button>
          ))}
        </div>
        <label htmlFor={`${id}-date`} className="sr-only">
          {t('otherDate')}
        </label>
        <input
          id={`${id}-date`}
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputClass} h-11 text-[15px]`}
        />
      </fieldset>
      <label htmlFor={`${id}-note`} className="text-[14px] font-semibold">
        {t('whatHappened')}
      </label>
      <input
        id={`${id}-note`}
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        className={`${inputClass} h-11 text-[15px]`}
      />
      {error && (
        <p role="alert" className="text-[13px] text-lock-text">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (!date || date < today) return setError(t('chooseDate'));
          void onQueue({
            key: crypto.randomUUID(),
            kind: 'nextDate',
            createdAt: new Date().toISOString(),
            label: t('labelNextDate', { title: hearing.title, date: day(date) }),
            payload: { caseId: hearing.caseId, date, note },
          });
        }}
        className="h-12 rounded-control bg-accent text-[16px] font-semibold text-on-accent"
      >
        {t('saveOnPhone')}
      </button>
      {canPhoto && (
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-control border border-border text-[15px] font-medium">
          <Icon name="photo" size={20} />
          {t('orderPhoto')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const chosen = e.target.files?.[0];
              e.target.value = '';
              if (!chosen) return;
              const file = await compressPhoto(chosen);
              if (!file) return setError(t('photoFailed'));
              await onQueue({
                key: crypto.randomUUID(),
                kind: 'orderPhoto',
                createdAt: new Date().toISOString(),
                label: t('labelPhoto', { title: hearing.title }),
                payload: {
                  caseId: hearing.caseId,
                  title: t('photoTitle', { date: day(today) }),
                  file,
                  fileName: file.name,
                },
              });
            }}
          />
        </label>
      )}
    </div>
  );
}
