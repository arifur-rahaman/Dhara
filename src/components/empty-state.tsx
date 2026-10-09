import Link from 'next/link';
import type { ReactNode } from 'react';

type Action = { href: string; label: string };

/**
 * First-run screen for an empty list (EmptyState design): a line drawing, what is missing,
 * what to do next, a main button, a second button and a small link.
 */
export function EmptyState({
  art,
  title,
  body,
  primary,
  secondary,
  link,
}: {
  art: ReactNode;
  title: string;
  body: string;
  primary?: Action;
  secondary?: Action;
  link?: Action;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-6 text-center">
      <span aria-hidden="true" className="text-muted">
        {art}
      </span>
      <h2 className="text-[20px] font-bold">{title}</h2>
      <p className="max-w-[340px] text-[15px] leading-[1.7] text-muted">{body}</p>
      {(primary || secondary) && (
        <div className="flex w-full max-w-[360px] flex-col gap-2.5 pt-2">
          {primary && (
            <Link
              href={primary.href}
              className="flex h-[52px] items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
            >
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="flex h-12 items-center justify-center rounded-control border border-border bg-surface text-[15px] font-medium"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
      {link && (
        <Link href={link.href} className="flex min-h-11 items-center text-[14px] font-semibold text-accent">
          {link.label}
        </Link>
      )}
    </div>
  );
}

const svg = {
  width: 120,
  height: 120,
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Open book (EmptyState design, cases). */
export const BookArt = () => (
  <svg {...svg}>
    <path d="M22 28c12-5 25-5 38 3v66c-13-8-26-8-38-3z" />
    <path d="M98 28c-12-5-25-5-38 3v66c13-8 26-8 38-3z" />
    <path d="M32 44h16M32 56h16M32 68h12M72 44h16M72 56h16" />
  </svg>
);

/** Two people (clients). Same line style as the book. */
export const PeopleArt = () => (
  <svg {...svg}>
    <circle cx="46" cy="44" r="14" />
    <path d="M20 94c0-15 12-26 26-26s26 11 26 26" />
    <circle cx="80" cy="50" r="11" />
    <path d="M70 72c3-1 6-2 10-2 12 0 20 9 20 22" />
  </svg>
);

/** Folder with a page (documents). */
export const FolderArt = () => (
  <svg {...svg}>
    <path d="M18 36a6 6 0 0 1 6-6h22l8 9h42a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z" />
    <path d="M44 58h32M44 70h24" />
  </svg>
);
