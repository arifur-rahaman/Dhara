import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { formatDate } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import type { CaseType } from '@/features/cases/queries';
import { removeDocument } from './actions';
import type { DocumentItem } from './queries';

/** Document rows (Documents design): icon, title, date · who added it, and a "Private" chip (P6). */
export async function DocumentList({ items, showCase = false }: { items: DocumentItem[]; showCase?: boolean }) {
  const t = await getTranslations();
  const prefs = await getPreferences();
  const day = (d: Date) => formatDate(d, prefs, { day: 'numeric', month: 'long' });
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('documents.none')}</p>
    );
  }
  return (
    <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
      {items.map((d) => (
        <li key={d.id} className="flex min-h-[68px] items-center gap-3 border-t border-border py-2 first:border-t-0">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-muted"
          >
            <Icon name={d.contentType === 'application/pdf' ? 'documents' : 'photo'} size={20} />
          </span>
          <a href={`/documents/${d.id}`} target="_blank" rel="noopener" className="flex min-w-0 grow flex-col gap-px">
            <span className="truncate text-[15px] font-semibold">{d.title}</span>
            <span className="truncate text-[13px] text-muted">
              {showCase && d.case && `${t(`caseType.${d.case.type as CaseType}`)} ${d.case.number}/${d.case.year} · `}
              {day(d.createdAt)} · {d.mine ? t('documents.you') : (d.uploadedByName ?? '')}
            </span>
          </a>
          {d.confidential && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-lock-bg px-[9px] py-1 text-[12px] font-semibold text-lock-text">
              <Icon name="lock" size={13} />
              {t('documents.private')}
            </span>
          )}
          {showCase ? (
            <Link
              href={`/cases/${d.caseId}?tab=documents`}
              aria-label={t('documents.openCase')}
              className="flex size-11 shrink-0 items-center justify-center text-muted"
            >
              <Icon name="chevron" size={18} />
            </Link>
          ) : (
            d.canRemove && (
              <details className="relative shrink-0">
                <summary
                  aria-label={t('documents.more', { title: d.title })}
                  className="flex size-11 cursor-pointer list-none items-center justify-center text-muted [&::-webkit-details-marker]:hidden"
                >
                  <Icon name="dotsVertical" size={20} />
                </summary>
                <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-[12px] border border-border bg-surface p-2 shadow-lg">
                  <a href={`/documents/${d.id}?download=1`} className="flex h-11 items-center px-2 text-[15px]">
                    {t('documents.download')}
                  </a>
                  <form action={removeDocument}>
                    <input type="hidden" name="documentId" value={d.id} />
                    <button className="flex h-11 w-full items-center px-2 text-left text-[15px] text-lock-text">
                      {t('documents.remove')}
                    </button>
                  </form>
                </div>
              </details>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

export async function KindFilter({ base, current }: { base: string; current?: string }) {
  const t = await getTranslations('documents');
  const chips = [
    ['all', undefined],
    ['order', 'order'],
    ['pleading', 'pleading'],
    ['other', 'other'],
  ] as const;
  return (
    <nav aria-label={t('filter')} className="-mx-1 flex gap-2 overflow-x-auto px-1">
      {chips.map(([label, kind]) => {
        const active = current === kind;
        const href = kind ? `${base}${base.includes('?') ? '&' : '?'}kind=${kind}` : base;
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] ${
              active ? 'bg-text font-semibold text-bg' : 'border border-border bg-surface'
            }`}
          >
            {t(`kinds.${label}`)}
          </Link>
        );
      })}
    </nav>
  );
}
