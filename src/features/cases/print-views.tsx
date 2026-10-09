import { getTranslations } from 'next-intl/server';
import type { Ymd } from '@/lib/dates';
import { caseDisplay } from './display';
import type { CaseDetail, TodayHearing } from './queries';

/**
 * Printable daily list (F6): one table per court with serial, case, party and assignee, plus empty
 * columns to write in what happened and the next date at court. Always printed light.
 */
export async function DailyListPrint({ date, chamber, items }: { date: Ymd; chamber: string; items: TodayHearing[] }) {
  const t = await getTranslations();
  const d = await caseDisplay();
  const byCourt = new Map<string, TodayHearing[]>();
  for (const h of items) {
    const key = d.court(h.court, h.courtNo);
    byCourt.set(key, [...(byCourt.get(key) ?? []), h]);
  }
  return (
    <article className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between border-b border-border pb-3">
        <div>
          <h1 className="font-title text-[24px]">{t('print.dailyTitle')}</h1>
          <p className="text-[14px] text-muted">{chamber}</p>
        </div>
        <p className="text-[15px] font-semibold">{d.long(date)}</p>
      </header>
      {items.length === 0 && <p className="text-[15px] text-muted">{t('today.none')}</p>}
      {[...byCourt.entries()].map(([court, list]) => (
        <section key={court} className="break-inside-avoid">
          <h2 className="pb-1.5 text-[16px] font-semibold">{court}</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th scope="col" className="w-[13%] border border-border px-2 py-1.5 font-semibold">
                  {t('print.serial')}
                </th>
                <th scope="col" className="w-[22%] border border-border px-2 py-1.5 font-semibold">
                  {t('print.case')}
                </th>
                <th scope="col" className="w-[20%] border border-border px-2 py-1.5 font-semibold">
                  {t('print.party')}
                </th>
                <th scope="col" className="w-[25%] border border-border px-2 py-1.5 font-semibold">
                  {t('print.whatHappened')}
                </th>
                <th scope="col" className="w-[20%] border border-border px-2 py-1.5 font-semibold">
                  {t('print.nextDate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((h) => (
                <tr key={h.hearingId} className="h-12 align-top">
                  <td className="border border-border px-2 py-1.5">{h.serial ?? ''}</td>
                  <td className="border border-border px-2 py-1.5 font-semibold">
                    {d.title(h)}
                    {h.assigneeName && (
                      <span className="block text-[12px] font-normal text-muted">{h.assigneeName}</span>
                    )}
                  </td>
                  <td className="border border-border px-2 py-1.5">
                    {h.clientName ? `${t(`ourSide.${h.ourSide}`)}: ${h.clientName}` : ''}
                  </td>
                  <td className="border border-border px-2 py-1.5" />
                  <td className="border border-border px-2 py-1.5" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <footer className="text-[11px] text-muted">{t('print.footer')}</footer>
    </article>
  );
}

/** A case's hearing history (F6): every date, what happened and who recorded it. */
export async function HistoryPrint({ c, chamber }: { c: CaseDetail; chamber: string }) {
  const t = await getTranslations();
  const d = await caseDisplay();
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        <p className="text-[13px] text-muted">
          {chamber} · {t('print.historyTitle')}
        </p>
        <h1 className="font-title text-[24px]">{d.title(c)}</h1>
        <p className="text-[14px]">{d.court(c.court, c.courtNo)}</p>
        {(c.partiesText || c.clientName) && (
          <p className="text-[14px]">
            {c.partiesText ?? t('today.party', { side: t(`ourSide.${c.ourSide}`), name: c.clientName! })}
          </p>
        )}
        <p className="text-[14px]">
          {t('caseDetail.nextDate')}:{' '}
          <strong>{c.nextHearing ? d.long(c.nextHearing.date) : t('caseDetail.noNextDate')}</strong>
        </p>
      </header>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left">
            <th scope="col" className="w-[24%] border border-border px-2 py-1.5 font-semibold">
              {t('print.date')}
            </th>
            <th scope="col" className="border border-border px-2 py-1.5 font-semibold">
              {t('print.whatHappened')}
            </th>
            <th scope="col" className="w-[22%] border border-border px-2 py-1.5 font-semibold">
              {t('print.recordedBy')}
            </th>
          </tr>
        </thead>
        <tbody>
          {c.timeline.map((e) => (
            <tr key={e.id} className="align-top">
              <td className="border border-border px-2 py-1.5">{d.medium(e.date)}</td>
              <td className="border border-border px-2 py-1.5">{e.outcomeNote ?? ''}</td>
              <td className="border border-border px-2 py-1.5">
                {e.byYou ? t('caseDetail.addedByYou') : (e.addedByName ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="text-[11px] text-muted">{t('print.footer')}</footer>
    </article>
  );
}
