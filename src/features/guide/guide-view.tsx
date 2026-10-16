import { Fragment } from 'react';
import { guide, inline, type GuideBlock } from './content';

function Inline({ text }: { text: string }) {
  return (
    <>
      {inline(text).map((part, i) =>
        part.kind === 'bold' ? (
          <b key={i} className="font-semibold">
            {part.text}
          </b>
        ) : part.kind === 'ui' ? (
          <span key={i} className="font-semibold whitespace-nowrap text-accent">
            {part.text}
          </span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if ('h' in block) return <h3 className="mt-2 text-[17px] font-semibold">{block.h}</h3>;
  if ('p' in block)
    return (
      <p>
        <Inline text={block.p} />
      </p>
    );
  if ('steps' in block || 'list' in block) {
    const items = 'steps' in block ? block.steps : block.list;
    const Tag = 'steps' in block ? 'ol' : 'ul';
    return (
      <Tag className={`flex flex-col gap-1.5 pl-6 ${'steps' in block ? 'list-decimal' : 'list-disc'}`}>
        {items.map((item, i) => (
          <li key={i}>
            <Inline text={item} />
          </li>
        ))}
      </Tag>
    );
  }
  if ('note' in block || 'lock' in block) {
    const lock = 'lock' in block;
    return (
      <p
        className={`rounded-[12px] border-l-4 px-4 py-3 text-[15px] ${
          lock ? 'border-lock-text bg-lock-bg' : 'border-ok bg-ok-bg'
        }`}
      >
        <Inline text={lock ? block.lock : block.note} />
      </p>
    );
  }
  return (
    // Focusable so keyboard users can scroll the table sideways on a phone.
    <div
      role="region"
      aria-label={block.table.head.join(', ')}
      tabIndex={0}
      className="overflow-x-auto rounded-[12px] border border-border bg-surface"
    >
      <table className="w-full min-w-[540px] border-collapse text-[14.5px]">
        <thead>
          <tr className="bg-accent-soft">
            {block.table.head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, r) => (
            <tr key={r} className="border-t border-border">
              {row.map((cell, c) =>
                c === 0 ? (
                  <th key={c} scope="row" className="px-3 py-2.5 text-left font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={c} className="px-3 py-2.5">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const bnDigits = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

/** The guide's contents list and sections. Always in Bangla (the guide is written in Bangla). */
export function GuideView() {
  return (
    <div lang="bn" className="flex flex-col gap-10 text-[16.5px] leading-[1.8]">
      <nav aria-label="সূচিপত্র" className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-2 text-[14px] font-semibold text-muted">সূচিপত্র</h2>
        <ol className="list-decimal pl-6 sm:columns-2 sm:gap-8">
          {guide.sections.map((s) => (
            <li key={s.id} className="break-inside-avoid">
              <a href={`#${s.id}`} className="underline decoration-border underline-offset-4 hover:text-accent">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {guide.sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="flex scroll-mt-4 flex-col gap-3">
          <h2
            id={`${s.id}-title`}
            className="flex items-baseline gap-3 font-title text-[26px] leading-[1.3] font-normal"
          >
            <span className="rounded-full bg-accent-soft px-2.5 text-[14px] font-semibold text-accent">
              {bnDigits(i + 1)}
            </span>
            {s.title}
          </h2>
          {s.blocks.map((b, j) => (
            <Block key={j} block={b} />
          ))}
        </section>
      ))}
    </div>
  );
}
