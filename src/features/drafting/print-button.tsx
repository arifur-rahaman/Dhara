'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-12 rounded-control bg-accent px-4 text-[16px] font-semibold text-on-accent"
    >
      {label}
    </button>
  );
}
