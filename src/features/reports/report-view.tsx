import { getTranslations } from 'next-intl/server';
import { dbDate } from '@/lib/dates';
import { formatDate, formatNumber, formatTaka } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import type { reportData } from './queries';

type Data = NonNullable<Awaited<ReturnType<typeof reportData>>>;

/**
 * Reports (docs/design/Reports.dc.html, F23). One series per chart, so no legend box: the titles name them.
 * Every bar carries its value label, a hover/focus tooltip with the exact amount, and the data is
 * also available as a table (for screen readers and for print).
 */
export async function ReportView({ data, interactive = true }: { data: Data; interactive?: boolean }) {
  const t = await getTranslations('reports');
  const tAll = await getTranslations();
  const prefs = await getPreferences();
  const month = (ymd: string) => formatDate(dbDate(ymd), prefs, { month: 'long' });
  const monthYear = (ymd: string) => formatDate(dbDate(ymd), prefs, { month: 'long', year: 'numeric' });
  const compact = (poisha: number) =>
    `৳${formatNumber(poisha / 100, prefs, { notation: 'compact', maximumFractionDigits: 1 })}`;
  const max = Math.max(...data.months.map((m) => m.poisha), 1);
  const current = data.months[data.months.length - 1];
  const courtMax = Math.max(...data.byCourt.map((c) => c.count), 1);
  const courtName = (c: Data['byCourt'][number]['court']) => (prefs.locale === 'bn' ? c.nameBn : c.nameEn);

  const stats: [string, string, boolean][] = [
    [t('collection', { month: month(current.month) }), formatTaka(current.poisha, prefs), false],
    [t('totalDue'), formatTaka(data.duePoisha, prefs), true],
    [t('activeCases'), formatNumber(data.activeCases, prefs), false],
    [t('hearings', { month: month(data.thisMonth) }), formatNumber(data.hearingsThisMonth, prefs), false],
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(([label, value, due]) => (
          <div
            key={label}
            className={`flex flex-col gap-1 rounded-[14px] px-[18px] py-4 ${due ? 'bg-lock-bg' : 'border border-border bg-surface'}`}
          >
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className={`text-[22px] font-bold lg:text-[26px] ${due ? 'text-lock-text' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="report-monthly"
          className="flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-[18px]"
        >
          <h2 id="report-monthly" className="text-[16px] font-semibold">
            {t('monthly')}
          </h2>
          <ul
            className="flex h-[220px] items-end justify-between gap-2 border-b border-border sm:gap-3.5"
            aria-hidden={!interactive}
          >
            {data.months.map((m) => {
              const isCurrent = m.month === current.month;
              const h = m.poisha === 0 ? 0 : Math.max(4, Math.round((m.poisha / max) * 180));
              return (
                <li key={m.month} className="group relative flex h-full grow flex-col items-center justify-end gap-1.5">
                  <span className={`text-[12px] font-semibold ${isCurrent ? 'text-text' : 'text-muted'}`}>
                    {m.poisha ? compact(m.poisha) : ''}
                  </span>
                  <span
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={`${monthYear(m.month)}: ${formatTaka(m.poisha, prefs)}`}
                    className={`w-full max-w-14 rounded-t-[4px] outline-offset-2 ${isCurrent ? 'bg-accent' : 'bg-chart-past'}`}
                    style={{ height: `${h}px` }}
                  />
                  {interactive && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[13px] whitespace-nowrap shadow-md group-focus-within:block [@media(hover:hover)]:group-hover:block"
                    >
                      {monthYear(m.month)} · <strong>{formatTaka(m.poisha, prefs)}</strong>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-2 sm:gap-3.5" aria-hidden="true">
            {data.months.map((m) => (
              <span key={m.month} className="grow basis-0 truncate text-center text-[13px] text-muted">
                <span className={data.months.length > 6 ? '' : 'sm:hidden'}>
                  {formatDate(dbDate(m.month), prefs, { month: 'short' })}
                </span>
                {data.months.length <= 6 && (
                  <span className="hidden sm:inline">{formatDate(dbDate(m.month), prefs, { month: 'long' })}</span>
                )}
              </span>
            ))}
          </div>
          <details className="text-[14px]" open={!interactive}>
            <summary className="flex h-11 cursor-pointer items-center font-semibold text-accent">
              {t('asTable')}
            </summary>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[13px] text-muted">
                  <th scope="col" className="py-1.5 font-semibold">
                    {t('month')}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    {t('collected')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-t border-border">
                    <th scope="row" className="py-1.5 font-normal">
                      {monthYear(m.month)}
                    </th>
                    <td className="py-1.5 text-right">{formatTaka(m.poisha, prefs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section
          aria-labelledby="report-courts"
          className="flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-[18px]"
        >
          <h2 id="report-courts" className="text-[16px] font-semibold">
            {t('byCourt')}
          </h2>
          {data.byCourt.length === 0 ? (
            <p className="text-[14px] text-muted">{t('noCases')}</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {data.byCourt.slice(0, 8).map((c) => (
                <li key={c.court.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="min-w-0 truncate">
                      {courtName(c.court)}
                      {c.court.district && (
                        <span className="text-muted"> · {tAll(`districts.${c.court.district}`)}</span>
                      )}
                    </span>
                    <span className="font-semibold">{formatNumber(c.count, prefs)}</span>
                  </div>
                  <div className="flex h-2 rounded-[4px] bg-surface-2" aria-hidden="true">
                    <span
                      className="h-2 rounded-[4px] bg-accent"
                      style={{ width: `${Math.round((c.count / courtMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
