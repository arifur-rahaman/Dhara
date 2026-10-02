/** Placeholder mark until the logo is designed (plan.md section 12). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-accent font-title text-on-accent"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      lang="bn"
    >
      ধ
    </span>
  );
}
