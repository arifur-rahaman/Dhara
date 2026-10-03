import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { listClients } from '@/features/clients/queries';
import { PillLink, TabHeader } from '@/features/cases/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clients');
  return { title: t('title') };
}

/** Client list (names only, P2). Not in the designs; follows the CaseList layout. */
export default async function ClientsPage({ searchParams }: PageProps<'/clients'>) {
  const ctx = await requireCtx();
  if (!can.listClients(ctx)) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const t = await getTranslations();
  const clients = await listClients(ctx, q);
  const assigned = ctx.role === 'associate' && ctx.caseScope === 'assigned';

  return (
    <div className="flex flex-col gap-3">
      <TabHeader
        title={t('clients.title')}
        action={can.createClient(ctx) && <PillLink href="/clients/new">{t('clients.new')}</PillLink>}
      />
      <form role="search" className="relative mt-1">
        <label htmlFor="client-search" className="sr-only">
          {t('clients.searchLabel')}
        </label>
        <Icon name="search" size={20} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
        <input
          id="client-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('clients.searchPlaceholder')}
          className="h-12 w-full rounded-control border border-border bg-surface pr-4 pl-11 text-[16px]"
        />
      </form>
      {clients.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
          {q ? t('clients.noResults') : t('clients.empty')}
        </p>
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
          {clients.map((c) => (
            <li key={c.id} className="border-t border-border first:border-t-0">
              <Link href={`/clients/${c.id}`} className="flex min-h-16 items-center gap-3 py-2">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-title text-[18px] text-accent"
                >
                  {c.name.trim().charAt(0)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  <span className="text-[13px] text-muted">
                    {assigned
                      ? t('clients.assignedCount', { count: c.caseCount })
                      : t('clients.caseCount', { count: c.caseCount })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
