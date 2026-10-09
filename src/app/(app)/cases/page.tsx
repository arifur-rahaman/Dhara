import type { Metadata } from 'next';
import Link from 'next/link';
import { BookArt, EmptyState } from '@/components/empty-state';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { listCases, type CaseFilter } from '@/features/cases/queries';
import { CaseRow, DateChip, PillLink, TabHeader } from '@/features/cases/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cases');
  return { title: t('title') };
}

const filters: CaseFilter[] = ['all', 'today', 'week', 'supreme', 'district'];

/** Case list (CaseList design) with search and filters; empty state from EmptyState design. */
export default async function CasesPage({ searchParams }: PageProps<'/cases'>) {
  const ctx = await requireCtx();
  if (!can.listCases(ctx)) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const filter = filters.includes(sp.filter as CaseFilter) ? (sp.filter as CaseFilter) : 'all';
  const t = await getTranslations();
  const d = await caseDisplay();
  const cases = await listCases(ctx, { q, filter });
  const canAdd = can.createCase(ctx);
  const isEmptyChamber = cases.length === 0 && !q && filter === 'all';

  if (isEmptyChamber) {
    return (
      <div className="flex min-h-[70dvh] flex-col">
        <h1 className="page-title">{t('cases.title')}</h1>
        <EmptyState
          art={<BookArt />}
          title={t('cases.emptyTitle')}
          body={canAdd ? t('cases.emptyBody') : t('cases.emptyNoAdd')}
          primary={canAdd ? { href: '/cases/new', label: t('cases.emptyCta') } : undefined}
          secondary={can.importCases(ctx) ? { href: '/cases/import', label: t('cases.emptyImport') } : undefined}
          link={{ href: '/courses/basic-computer-6', label: t('cases.emptyHowTo') }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TabHeader title={t('cases.title')} action={canAdd && <PillLink href="/cases/new">{t('cases.new')}</PillLink>} />

      <form role="search" className="relative mt-1">
        <label htmlFor="case-search" className="sr-only">
          {t('cases.searchLabel')}
        </label>
        <Icon name="search" size={20} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
        <input
          id="case-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('cases.searchPlaceholder')}
          className="h-12 w-full rounded-control border border-border bg-surface pr-4 pl-11 text-[16px]"
        />
        {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
      </form>

      <nav aria-label={t('cases.filtersLabel')} className="-mx-5 overflow-x-auto px-5">
        <ul className="flex gap-2">
          {filters.map((f) => {
            const active = f === filter;
            const params = new URLSearchParams({ ...(q ? { q } : {}), ...(f !== 'all' ? { filter: f } : {}) });
            return (
              <li key={f} className="shrink-0">
                <Link
                  href={`/cases${params.size ? `?${params}` : ''}`}
                  aria-current={active ? 'true' : undefined}
                  className={`flex h-11 items-center rounded-full px-3.5 text-[14px] ${
                    active ? 'bg-text font-semibold text-bg' : 'border border-border bg-surface'
                  }`}
                >
                  {t(`cases.filter.${f}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {cases.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
          {t('cases.noResults')}
        </p>
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
          {cases.map((c) => (
            <CaseRow
              key={c.id}
              href={`/cases/${c.id}`}
              title={d.title(c)}
              court={d.court(c.court, c.courtNo)}
              client={c.clientName}
              chip={
                c.nextDate ? (
                  <DateChip
                    today={c.nextDate === d.today}
                    label={c.nextDate === d.today ? t('cases.todayChip') : d.short(c.nextDate)}
                  />
                ) : (
                  <span className="shrink-0 text-[12px] text-muted">{t('cases.noDate')}</span>
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
