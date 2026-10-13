/** The draft on screen and on paper, with a DRAFT watermark across it (plan.md 7.5). */
export function DraftPaper({ text }: { text: string }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-white p-5 text-[15px] leading-[1.8] text-[#1B1D22]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex [transform:rotate(-24deg)] items-center justify-center text-[72px] font-bold tracking-[0.2em] text-[#1B1D22]/[0.07] select-none"
      >
        DRAFT
      </span>
      <div className="relative font-title whitespace-pre-wrap">{text}</div>
    </div>
  );
}
