'use client';

import { useFormStatus } from 'react-dom';
import { startTransition, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

/** Input styling from the designs: 48–52px tall, 12px radius, surface background. */
export const inputClass =
  'h-[52px] w-full rounded-control border border-border bg-surface px-4 text-[17px] text-text placeholder:text-muted/70 aria-invalid:border-lock-text';

export function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = '',
  pending: busy,
  ...props
}: ComponentProps<'button'> & { pending?: boolean }) {
  const pending = useFormStatus().pending || !!busy;
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`h-[52px] rounded-control bg-accent px-4 text-[17px] font-semibold text-on-accent disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  pending: busy,
  ...props
}: ComponentProps<'button'> & { pending?: boolean }) {
  const pending = useFormStatus().pending || !!busy;
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`h-12 rounded-control border border-border bg-transparent px-4 text-[16px] font-medium disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

/** Error message in words that say what happened and how to fix it. Announced to screen readers. */
export function FormError({ id, error }: { id?: string; error?: string }) {
  const t = useTranslations('errors');
  if (!error) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text"
    >
      {t(error)}
    </p>
  );
}

/**
 * Form for useActionState actions that keeps what was typed when the action returns an error.
 * With a function in `action`, React resets the whole form after each submit; submitting from
 * onSubmit inside a transition avoids that. Without JavaScript the plain `action` still works.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & { action: (form: FormData) => void }) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form {...props} action={action} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
