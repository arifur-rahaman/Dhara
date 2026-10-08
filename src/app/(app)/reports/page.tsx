import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { dbDate } from '@/lib/dates';
import { formatDate } from '@/i18n/format';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { getPreferences } from '@/features/preferences/server';
import { reportData, ranges, type Range } from '@/features/reports/queries';
import { ReportView } from '@/features/reports/report-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('reports') };
}

/** Reports (docs/design/Reports.dc.html, F23), owner only. */
export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const ctx = await requireCtx();
  if (!can.viewReports(ctx)) notFound();
  const sp = await searchParams;
  const range: Range = sp.range === 'month' || sp.range === 'year' ? sp.range : 'half';
  const data = (await reportData(ctx, range))!;
  const t = await getTranslations('reports');
  const prefs = await getPreferences();
  const first = data.months[0].month;
  const last = data.months[data.months.length - 1].month;
  const span =
    first === last
      ? formatDate(dbDate(last), prefs, { month: 'long', year: 'numeric' })
      : t('span', {
          from: formatDate(dbDate(first), prefs, {
            month: 'long',
            ...(first.slice(0, 4) !== last.slice(0, 4) ? { year: 'numeric' } : {}),
          }),
          to: formatDate(dbDate(last), prefs, { month: 'long', year: 'numeric' }),
        });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="page-title">{t('title')}</h1>
          <p className="text-[15px] text-muted">{span}</p>
        </div>
        <div className="flex items-center gap-3">
          <nav
            aria-label={t('range')}
            className="grid w-[260px] grid-cols-3 gap-0.5 rounded-[10px] bg-surface-2 p-[3px]"
          >
            {(Object.keys(ranges) as Range[]).map((r) => (
              <Link
                key={r}
                href={r === 'half' ? '/reports' : `/reports?range=${r}`}
                aria-current={r === range ? 'page' : undefined}
                className={`flex h-[38px] items-center justify-center rounded-[8px] text-[14px] ${
                  r === range ? 'bg-surface font-semibold text-text' : 'text-muted'
                }`}
              >
                {t(`ranges.${r}`)}
              </Link>
            ))}
          </nav>
          <a
            href={`/reports/pdf?range=${range}`}
            className="flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-[15px] font-semibold"
          >
            <Icon name="documents" size={18} />
            PDF
          </a>
        </div>
      </div>
      <ReportView data={data} />
    </div>
  );
}
