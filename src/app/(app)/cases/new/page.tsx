import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { assigneeOptions, courtOptions } from '@/features/cases/queries';
import { clientNameOptions } from '@/features/clients/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { CaseForm } from './case-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('caseForm');
  return { title: t('title') };
}

export default async function NewCasePage() {
  const ctx = await requireCtx();
  if (!can.createCase(ctx)) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [courts, clients, assignees] = await Promise.all([
    courtOptions(ctx),
    clientNameOptions(ctx),
    assigneeOptions(ctx),
  ]);
  const option = (c: (typeof courts)[number]) => ({ value: c.id, label: d.court(c.label, null) });

  return (
    <div className="flex max-w-[520px] flex-col gap-3">
      <SubpageHeader title={t('caseForm.title')} backHref="/cases" />
      <CaseForm
        today={d.today}
        defaultCourtId={courts.find((c) => c.label.nameEn === 'Joint District Judge Court')?.id}
        supremeCourts={courts.filter((c) => c.supreme).map(option)}
        districtCourts={courts.filter((c) => !c.supreme).map(option)}
        clients={clients.map((c) => c.displayName)}
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
