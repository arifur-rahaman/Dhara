import { getTranslations } from 'next-intl/server';

/** "Step n/3" with the progress bar from the Onboarding design. */
export async function Steps({ current, total = 3 }: { current: number; total?: number }) {
  const t = await getTranslations('onboarding');
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold text-muted">{t('step', { current, total })}</span>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-[5px] rounded-[3px] ${i < current ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>
    </div>
  );
}
