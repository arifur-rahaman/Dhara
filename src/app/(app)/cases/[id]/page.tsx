import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { Icon } from '@/components/icons';
import { isYmd } from '@/lib/dates';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { getCase } from '@/features/cases/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata({ params }: PageProps<'/cases/[id]'>): Promise<Metadata> {
  const ctx = await requireCtx();
  const { id } = await params;
  const c = isUuid(id) ? await getCase(ctx, id) : null;
  const d = await caseDisplay();
  return { title: c ? d.title(c) : undefined };
}

const tabs = ['timeline', 'documents', 'notes', 'fees'] as const;
type Tab = (typeof tabs)[number];

/** Case detail and timeline (CaseDetail design, F1, F7). */
export default async function CasePage({ params, searchParams }: PageProps<'/cases/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const c = await getCase(ctx, id);
  if (!c) notFound();
  const sp = await searchParams;
  const visibleTabs = tabs.filter((tab) => tab !== 'fees' || can.viewFees(ctx));
  const tab: Tab = visibleTabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'timeline';
  const saved = typeof sp.saved === 'string' && isYmd(sp.saved) ? sp.saved : null;
  const t = await getTranslations();
  const d = await caseDisplay();

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5 pb-20">
      <SubpageHeader title={t('caseDetail.title')} backHref="/cases" heading={false} />

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-title text-[25px] leading-[1.35] font-normal">{d.title(c)}</h1>
          {can.createCase(ctx) && (
            <Link
              href={`/cases/${c.id}/edit`}
              className="flex h-11 shrink-0 items-center px-1 text-[14px] font-semibold text-accent"
            >
              {t('caseForm.edit')}
            </Link>
          )}
        </div>
        <span className="text-[14px] text-muted">{d.court(c.court, c.courtNo)}</span>
        {(c.partiesText || c.clientName) && (
          <span className="text-[14px]">
            {c.partiesText ??
              (c.clientId ? (
                <Link href={`/clients/${c.clientId}`} className="underline">
                  {t('today.party', { side: t(`ourSide.${c.ourSide}`), name: c.clientName! })}
                </Link>
              ) : null)}
          </span>
        )}
      </div>

      {saved && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-4 py-3 text-[15px] text-ok">
          {t('caseDetail.saved', { date: d.medium(saved) })}
        </p>
      )}

      <section
        aria-label={t('caseDetail.nextDate')}
        className="flex flex-col gap-1.5 rounded-card bg-accent-soft px-4 py-3.5"
      >
        <span className="text-[13px] font-semibold text-accent">{t('caseDetail.nextDate')}</span>
        <span className="text-[20px] font-bold">
          {c.nextHearing ? d.long(c.nextHearing.date) : t('caseDetail.noNextDate')}
        </span>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {c.nextHearing?.serial && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-[13px]">
              {t('today.serial', { serial: c.nextHearing.serial })}
            </span>
          )}
          {c.assignee?.name && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-[13px]">
              {t('caseDetail.assigned', { name: c.assignee.name })}
            </span>
          )}
        </div>
      </section>

      <nav aria-label={t('caseDetail.tabs')}>
        <ul
          className="grid gap-1 rounded-[12px] bg-surface-2 p-1"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((key) => (
            <li key={key}>
              <Link
                href={key === 'timeline' ? `/cases/${c.id}` : `/cases/${c.id}?tab=${key}`}
                aria-current={key === tab ? 'page' : undefined}
                className={`flex h-11 items-center justify-center rounded-[9px] text-[14px] ${
                  key === tab ? 'bg-surface font-semibold text-text' : 'text-muted'
                }`}
              >
                {t(`caseDetail.tab.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'timeline' &&
        (c.timeline.length === 0 ? (
          <p className="text-[15px] text-muted">{t('caseDetail.emptyTimeline')}</p>
        ) : (
          <ol aria-label={t('caseDetail.tab.timeline')} className="flex flex-col">
            {c.timeline.map((e, i) => (
              <li key={e.id} className="flex gap-3.5">
                <div className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                  <span className={`mt-[5px] size-3 rounded-full ${i === 0 ? 'bg-accent' : 'bg-muted'}`} />
                  <span className={`w-0.5 grow ${i === c.timeline.length - 1 ? 'bg-transparent' : 'bg-border'}`} />
                </div>
                <div className="flex grow flex-col gap-[3px] pb-[18px]">
                  <span className="text-[13px] font-semibold text-muted">{d.medium(e.date)}</span>
                  {e.outcomeNote && <span className="text-[15px]">{e.outcomeNote}</span>}
                  <span className="text-[12px] text-muted">
                    {e.byYou
                      ? t('caseDetail.addedByYou')
                      : e.addedByName
                        ? t('caseDetail.addedBy', { name: e.addedByName })
                        : ''}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ))}

      {tab === 'notes' && (
        <dl className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-[15px]">
          {!c.note && !c.opposingCounsel && !c.partiesText && <p className="text-muted">{t('caseDetail.noNotes')}</p>}
          {c.partiesText && (
            <div>
              <dt className="text-[13px] text-muted">{t('caseForm.parties')}</dt>
              <dd>{c.partiesText}</dd>
            </div>
          )}
          {c.opposingCounsel && (
            <div>
              <dt className="text-[13px] text-muted">{t('caseForm.opposingCounsel')}</dt>
              <dd>{c.opposingCounsel}</dd>
            </div>
          )}
          {c.note && (
            <div>
              <dt className="text-[13px] text-muted">{t('caseForm.note')}</dt>
              <dd className="whitespace-pre-line">{c.note}</dd>
            </div>
          )}
        </dl>
      )}
      {tab === 'documents' && <p className="text-[15px] text-muted">{t('caseDetail.documentsLater')}</p>}
      {tab === 'fees' && <p className="text-[15px] text-muted">{t('caseDetail.feesLater')}</p>}

      {c.officialUrl && (
        <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
          <a
            href={c.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[15px] font-semibold text-accent"
          >
            <Icon name="external" size={18} />
            {t('caseDetail.officialPage')}
          </a>
          <span className="text-[13px] text-muted">{t('caseDetail.officialNote')}</span>
        </div>
      )}

      {c.canAddHearing && (
        <div className="fixed inset-x-0 bottom-[var(--spacing-tabbar)] z-10 border-t border-border bg-surface px-5 pt-3 pb-3 md:static md:mt-2 md:border-0 md:bg-transparent md:p-0">
          <Link
            href={`/cases/${c.id}/next-date`}
            className="mx-auto flex h-[50px] max-w-[600px] items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
          >
            {t('today.addNextDate')}
          </Link>
        </div>
      )}
    </div>
  );
}
