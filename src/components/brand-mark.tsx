import { Icon } from './icons';

/** The Pocket Chamber logo on its blue tile, as on the app icon (scripts/generate-icons.mjs). */
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
