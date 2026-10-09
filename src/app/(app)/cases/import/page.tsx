import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { assigneeOptions, courtOptions } from '@/features/cases/queries';
import { ImportWizard } from '@/features/import/wizard';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('import');
  return { title: t('title') };
}

/** F20: cases from an old diary kept in Excel or CSV. Owner and associates, like Add case. */
export default async function ImportCasesPage() {
  const ctx = await requireCtx();
  if (!can.importCases(ctx)) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [courts, assignees] = await Promise.all([courtOptions(ctx), assigneeOptions(ctx)]);
  const option = (c: (typeof courts)[number]) => ({ value: c.id, label: d.court(c.label, null) });

  return (
    <div className="flex max-w-[720px] flex-col gap-3">
      <SubpageHeader title={t('import.title')} backHref="/cases" />
      <p className="text-[15px] leading-relaxed text-muted">{t('import.intro')}</p>
      <ImportWizard
        supremeCourts={courts.filter((c) => c.supreme).map(option)}
        districtCourts={courts.filter((c) => !c.supreme).map(option)}
        assignees={
          can.assignCase(ctx)
            ? assignees.map((a) => ({
                value: a.id,
                label: a.userId === ctx.userId ? t('today.you') : `${a.user.name ?? ''} (${t(`roles.${a.role}`)})`,
              }))
            : null
        }
      />
    </div>
  );
}
