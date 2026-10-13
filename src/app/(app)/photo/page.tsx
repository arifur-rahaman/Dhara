import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { caseDisplay } from '@/features/cases/display';
import { hearingsOn, listCases } from '@/features/cases/queries';
import { OrderPhotoFlow } from '@/features/order-photo/flow';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('orderPhoto');
  return { title: t('title') };
}

/**
 * Order photo → next date (OrderPhoto design, F37). The munshi's "Photo" tab; owners and associates open it
 * from a case. Today's cases come first. Off until the owner allows AI reading in Settings.
 */
export default async function OrderPhotoPage({ searchParams }: PageProps<'/photo'>) {
  const ctx = await requireCtx();
  if (ctx.role === 'staff') notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const on = await withTenant(
    scopeOf(ctx),
    async (tx) =>
      (await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { aiPhotoReading: true } }))
        .aiPhotoReading,
  );
  const sp = await searchParams;
  const initial = typeof sp.case === 'string' ? sp.case : undefined;

  if (!on) {
    return (
      <div className="flex max-w-[560px] flex-col gap-3.5">
        <SubpageHeader title={t('orderPhoto.title')} backHref="/today" />
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] leading-relaxed text-muted">
          {can.editChamberSettings(ctx) ? t('orderPhoto.offOwner') : t('orderPhoto.offMember')}
        </p>
        {can.editChamberSettings(ctx) && (
          <Link
            href="/settings#settings-ai"
            className="flex h-12 items-center justify-center rounded-control border border-border text-[15px] font-semibold"
          >
            {t('orderPhoto.openSettings')}
          </Link>
        )}
      </div>
    );
  }

  const [today, all] = await Promise.all([hearingsOn(ctx, d.today), listCases(ctx)]);
  const seen = new Set<string>();
  const cases = [
    ...today.map((h) => ({ id: h.caseId, label: d.title(h), court: d.court(h.court, h.courtNo) })),
    ...all.map((c) => ({ id: c.id, label: d.title(c), court: d.court(c.court, c.courtNo) })),
  ].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('orderPhoto.title')} backHref="/today" />
      <p className="text-[14px] leading-relaxed text-muted">{t('orderPhoto.intro')}</p>
      {cases.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
          {t('orderPhoto.noCases')}
        </p>
      ) : (
        <OrderPhotoFlow
          cases={cases}
          initialCaseId={initial && seen.has(initial) ? initial : undefined}
          today={d.today}
        />
      )}
    </div>
  );
}
