'use client';

import { useId } from 'react';

type Option<T extends string> = { value: T; label: string; lang?: string };

export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
  hideLegend,
}: {
  legend: string;
  /** Keep the legend for screen readers only, when a visible heading already names the group. */
  hideLegend?: boolean;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-[13px] font-medium text-muted'}>{legend}</legend>
      <div className="flex gap-1 rounded-control border border-border bg-surface-2 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            lang={option.lang}
            className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-3 text-[15px] font-medium text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
