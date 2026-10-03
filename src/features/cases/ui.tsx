import Link from 'next/link';
import type { ReactNode } from 'react';

/** Date chip on case rows (CaseList design): filled for today, soft for later dates. */
export function DateChip({ label, today }: { label: string; today?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-[8px] px-2.5 py-[5px] text-[13px] font-semibold ${
        today ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent'
      }`}
    >
      {label}
    </span>
  );
}

/** Card holding rows separated by hairlines (CaseList, OwnerToday designs). */
export function RowCard({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-col rounded-card border border-border bg-surface px-4">
      {children}
    </ul>
  );
}

export function CaseRow({
  href,
  title,
  court,
  client,
  chip,
}: {
  href: string;
  title: string;
  court: string;
  client?: string | null;
  chip?: ReactNode;
}) {
  return (
    <li className="border-t border-border first:border-t-0">
      <Link href={href} className="flex min-h-[72px] items-center justify-between gap-3 py-2">
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className="text-[13px] text-muted">{court}</span>
          {client && <span className="text-[13px]">{client}</span>}
        </span>
        {chip}
      </Link>
    </li>
  );
}

/** Small page header used on the main tab screens: Tiro Bangla title with an optional action. */
export function TabHeader({ title, action, kicker }: { title: string; action?: ReactNode; kicker?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      {kicker}
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function PillLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent"
    >
      <span aria-hidden="true" className="text-[20px] leading-none">
        +
      </span>
      {children}
    </Link>
  );
}
