import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { Icon } from '@/components/icons';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { CaseRow, DateChip } from '@/features/cases/ui';
import { readClientContact } from '@/features/clients/contact';
import { getClient } from '@/features/clients/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client');
  return { title: t('title') };
}

/**
 * Client (OwnerClient and AssociateClient designs). Contact is read only for the owner (P1), and the read is audited.
 * Other roles get the locked card; their page never receives the values.
 */
export default async function ClientPage({ params }: PageProps<'/clients/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  const client = isUuid(id) ? await getClient(ctx, id) : null;
  if (!client) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const isOwner = can.viewClientContact(ctx);
  const contact = isOwner ? await readClientContact(ctx, id) : null;
  const local = (e164: string) => {
    const s = e164.replace(/^\+88/, '');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  };

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('client.title')} backHref="/clients" heading={false} />

      <div className="flex">
        <span
          className={`flex items-center gap-1.5 rounded-full py-[5px] pr-3 pl-2.5 text-[13px] font-semibold ${
            isOwner ? 'bg-accent-soft text-accent' : 'bg-surface-2'
          }`}
        >
          <Icon name={isOwner ? 'shield' : 'clients'} size={16} />
          {t('client.yourRole', { role: t(`roles.${ctx.role}`) })}
        </span>
      </div>

      <section className="flex items-center gap-3.5 rounded-card border border-border bg-surface px-4 py-3.5">
        <span
          aria-hidden="true"
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-title text-[24px] text-accent"
        >
          {client.name.trim().charAt(0)}
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[19px] font-semibold">{client.name}</h1>
          <span className="text-[14px] text-muted">
            {ctx.role === 'associate' && ctx.caseScope === 'assigned'
              ? t('clients.assignedCount', { count: client.cases.length })
              : t('clients.caseCount', { count: client.cases.length })}
          </span>
        </div>
      </section>

      {isOwner ? (
        <section
          aria-labelledby="client-contact"
          className="flex flex-col rounded-card border border-border bg-surface px-4 pt-3 pb-1"
        >
          <div className="flex items-center justify-between pb-2">
            <h2 id="client-contact" className="text-[15px] font-semibold">
              {t('client.contact')}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-1 text-[12px] font-semibold text-ok">
              <Icon name="eye" size={14} />
              {t('client.onlyYou')}
            </span>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border">
            <div className="flex flex-col">
              <span className="text-[12px] text-muted">{t('client.phone')}</span>
              <span className="text-[16px] font-medium" lang="en">
                {contact?.phone ? local(contact.phone) : <span className="text-muted">{t('client.notAdded')}</span>}
              </span>
            </div>
            {contact?.phone && (
              <div className="flex gap-2">
                <a
                  href={`tel:${contact.phone}`}
                  aria-label={t('client.call')}
                  className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent"
                >
                  <Icon name="phoneCall" size={20} />
                </a>
                <a
                  href={`sms:${contact.phone}`}
                  aria-label={t('client.message')}
                  className="flex size-11 items-center justify-center rounded-full border border-border"
                >
                  <Icon name="message" size={20} />
                </a>
              </div>
            )}
          </div>
          {(['email', 'nid', 'address'] as const).map((k) => (
            <div key={k} className="flex min-h-14 flex-col justify-center border-t border-border py-1.5">
              <span className="text-[12px] text-muted">{t(`client.${k}`)}</span>
              <span className="text-[16px] font-medium break-words">
                {contact?.[k] ?? <span className="text-muted">{t('client.notAdded')}</span>}
              </span>
            </div>
          ))}
          <Link
            href={`/clients/${id}/edit`}
            className="flex min-h-12 items-center border-t border-border text-[14px] font-semibold text-accent"
          >
            {t('client.editContact')}
          </Link>
        </section>
      ) : (
        <section
          aria-labelledby="client-contact"
          className="flex flex-col gap-2.5 rounded-card border border-border bg-surface px-4 pt-3 pb-3.5"
        >
          <div className="flex items-center justify-between">
            <h2 id="client-contact" className="text-[15px] font-semibold">
              {t('client.contact')}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-lock-bg px-2.5 py-1 text-[12px] font-semibold text-lock-text">
              <Icon name="lock" size={14} />
              {t('client.ownerOnly')}
            </span>
          </div>
          <div className="flex gap-3 rounded-[12px] bg-lock-bg p-3">
            <Icon name="lock" className="mt-0.5 shrink-0 text-lock-text" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t('client.private')}</span>
              <span className="text-[13.5px] text-muted">{t('client.privateBody')}</span>
            </div>
          </div>
          <div className="flex min-h-12 items-center justify-between border-t border-border">
            <div className="flex flex-col">
              <span className="text-[12px] text-muted">{t('client.phone')}</span>
              <span aria-hidden="true" className="text-[16px] font-medium tracking-[2px] text-muted">
                ••••• ••••••
              </span>
            </div>
            <span className="text-[12px] text-muted">{t('client.privateWord')}</span>
          </div>
        </section>
      )}

      {isOwner && (
        <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted">
          <Icon name="list" size={14} />
          {t('client.activity')}
        </p>
      )}

      <section aria-labelledby="client-cases" className="flex flex-col gap-2">
        <h2 id="client-cases" className="text-[15px] font-semibold">
          {ctx.role === 'associate' ? t('client.yourCases') : t('client.cases')}
        </h2>
        {client.cases.length > 0 && (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {client.cases.map((c) => (
              <CaseRow
                key={c.id}
                href={`/cases/${c.id}`}
                title={d.title(c)}
                court={d.court(c.court, c.courtNo)}
                chip={
                  c.nextDate ? (
                    <DateChip
                      today={c.nextDate === d.today}
                      label={c.nextDate === d.today ? t('cases.todayChip') : d.short(c.nextDate)}
                    />
                  ) : null
                }
              />
            ))}
          </ul>
        )}
      </section>

      {!can.viewFees(ctx) && (
        <section className="flex min-h-[52px] items-center justify-between rounded-card border border-border bg-surface px-4">
          <span className="text-[15px] font-semibold">{t('client.fees')}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-lock-bg px-2.5 py-1 text-[12px] font-semibold text-lock-text">
            <Icon name="lock" size={14} />
            {t('client.ownerOnly')}
          </span>
        </section>
      )}
    </div>
  );
}
