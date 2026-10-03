import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { deleteCase } from '@/features/cases/actions';
import { caseDisplay } from '@/features/cases/display';
import { assigneeOptions, courtOptions, visibleCasesWhere } from '@/features/cases/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { CaseForm } from '../../new/case-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('caseForm');
  return { title: t('editTitle') };
}

/** Edit case (same form as AddCase). Owner can also close or delete it. */
export default async function EditCasePage({ params, searchParams }: PageProps<'/cases/[id]/edit'>) {
  const ctx = await requireCtx();
  if (!can.createCase(ctx)) notFound();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const row = await withTenant(scopeOf(ctx), (tx) =>
    tx.case.findFirst({ where: { AND: [visibleCasesWhere(ctx), { id }] } }),
  );
  if (!row) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [courts, assignees] = await Promise.all([courtOptions(ctx), assigneeOptions(ctx)]);
  const option = (c: (typeof courts)[number]) => ({ value: c.id, label: d.court(c.label, null) });
  const confirming = (await searchParams).confirm === '1';

  return (
    <div className="flex max-w-[520px] flex-col gap-3">
      <SubpageHeader title={t('caseForm.editTitle')} backHref={`/cases/${id}`} />
      <CaseForm
        today={d.today}
        supremeCourts={courts.filter((c) => c.supreme).map(option)}
        districtCourts={courts.filter((c) => !c.supreme).map(option)}
        clients={[]}
        assignees={
          can.assignCase(ctx)
            ? assignees.map((a) => ({
                value: a.id,
                label: a.userId === ctx.userId ? t('today.you') : `${a.user.name ?? ''} (${t(`roles.${a.role}`)})`,
              }))
            : null
        }
        edit={{
          caseId: id,
          canClose: can.assignCase(ctx),
          values: {
            type: row.type,
            number: row.number,
            year: row.year,
            courtId: row.courtId,
            courtNo: row.courtNo ?? '',
            ourSide: row.ourSide,
            assignee: row.assigneeMembershipId ?? '',
            partiesText: row.partiesText ?? '',
            opposingCounsel: row.opposingCounsel ?? '',
            note: row.note ?? '',
            status: row.status,
          },
        }}
      />
      {can.deleteCase(ctx) && (
        <form action={deleteCase} className="mt-4 flex flex-col gap-2 rounded-card border border-border p-4">
          <input type="hidden" name="caseId" value={id} />
          <label className="flex min-h-11 items-start gap-3 text-[14px]">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              defaultChecked={false}
              className="mt-0.5 size-5 shrink-0"
            />
            <span>{t('caseForm.deleteConfirm')}</span>
          </label>
          {confirming && (
            <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
              {t('caseForm.deleteNeedsConfirm')}
            </p>
          )}
          <button className="h-12 rounded-control border border-lock-text text-[15px] font-semibold text-lock-text">
            {t('caseForm.delete')}
          </button>
        </form>
      )}
    </div>
  );
}
