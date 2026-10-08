import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCtx } from '@/server/context';
import { reportData, type Range } from '@/features/reports/queries';
import { ReportView } from '@/features/reports/report-view';

/** Print view of Reports for the PDF renderer: light, no app chrome, the table shown. */
export default async function PrintReports({ searchParams }: PageProps<'/print/reports'>) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const range: Range = sp.range === 'month' || sp.range === 'year' ? sp.range : 'half';
  const data = await reportData(ctx, range);
  if (!data) notFound();
  const t = await getTranslations('reports');
  return (
    <main data-print-ready className="paper mx-auto flex max-w-[960px] flex-col gap-4 p-8">
      <style>{'@page { size: A4 landscape; margin: 12mm; } html, body { background: #ffffff !important; }'}</style>
      <h1 className="font-title text-[28px]">{t('title')}</h1>
      <ReportView data={data} interactive={false} />
    </main>
  );
}
