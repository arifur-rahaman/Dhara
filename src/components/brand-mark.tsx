import { Icon } from './icons';

/** Book mark from docs/design (Main, TeamRoles). Logo is still an open decision (plan.md section 12). */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center bg-accent text-on-accent"
      style={{ width: size, height: size, borderRadius: size >= 44 ? 12 : 10 }}
    >
      <Icon name="brand" size={size / 2} />
    </span>
  );
}
