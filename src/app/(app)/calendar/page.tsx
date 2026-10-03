import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { dbDate, isYmd, monthGrid } from '@/lib/dates';
import { formatDate } from '@/i18n/format';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { hearingCountsInMonth, hearingsOn } from '@/features/cases/queries';
import { CaseRow } from '@/features/cases/ui';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar');
  return { title: t('title') };
}

/** Month calendar (F3). Not in the designs; uses the NextDate calendar style. */
export default async function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  const ctx = await requireCtx();
  if (!can.listCases(ctx)) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const sp = await searchParams;
  const day = typeof sp.day === 'string' && isYmd(sp.day) ? sp.day : d.today;
  const [year, month] = day.split('-').map(Number);
  const [counts, hearings] = await Promise.all([hearingCountsInMonth(ctx, year, month), hearingsOn(ctx, day)]);
  const monthStart = (delta: number) => {
    const m = new Date(Date.UTC(year, month - 1 + delta, 1));
    return m.toISOString().slice(0, 10);
  };
  const weekdays = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('calendar.title')} />
      <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?day=${monthStart(-1)}`}
            aria-label={t('nextDate.prevMonth')}
            className="flex size-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="back" size={18} />
          </Link>
          <span className="text-[15px] font-semibold">
            {formatDate(dbDate(day), d.prefs, { month: 'long', year: 'numeric' })}
          </span>
          <Link
            href={`/calendar?day=${monthStart(1)}`}
            aria-label={t('nextDate.nextMonth')}
            className="flex size-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="chevron" size={18} />
          </Link>
        </div>
        <table className="w-full table-fixed border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} scope="col" className="text-[12px] font-semibold text-muted">
                  {formatDate(dbDate(w), d.prefs, { weekday: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(year, month).map((week, i) => (
              <tr key={i}>
                {week.map((cell, j) => (
                  <td key={j}>
                    {cell && (
                      <Link
                        href={`/calendar?day=${cell}`}
                        aria-current={cell === day ? 'date' : undefined}
                        aria-label={`${d.medium(cell)}${counts[cell] ? `, ${t('calendar.count', { count: counts[cell] })}` : ''}`}
                        className={`flex h-12 flex-col items-center justify-center rounded-[12px] text-[14px] ${
                          cell === day
                            ? 'bg-accent font-bold text-on-accent'
                            : cell === d.today
                              ? 'font-semibold underline'
                              : ''
                        }`}
                      >
                        {formatDate(dbDate(cell), d.prefs, { day: 'numeric' })}
                        {counts[cell] ? (
                          <span
                            aria-hidden="true"
                            className={`text-[11px] font-semibold ${cell === day ? 'text-on-accent' : 'text-accent'}`}
                          >
                            {d.number(counts[cell])}
                          </span>
                        ) : null}
                      </Link>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="calendar-day" className="flex flex-col gap-2">
        <h2 id="calendar-day" className="text-[16px] font-semibold">
          {d.long(day)}
        </h2>
        {hearings.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
            {t('calendar.none')}
          </p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {hearings.map((h) => (
              <CaseRow
                key={h.hearingId}
                href={`/cases/${h.caseId}`}
                title={d.title(h)}
                court={d.court(h.court, h.courtNo)}
                client={h.clientName}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
