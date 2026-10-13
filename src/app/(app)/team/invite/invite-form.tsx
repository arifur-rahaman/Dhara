'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { inviteMember } from '@/features/team/actions';

const roles = ['associate', 'munshi', 'staff'] as const;

/** Member invite form (docs/design/InviteMember.dc.html). */
export function InviteForm({ bySms }: { bySms: boolean }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(inviteMember, undefined);
  const [role, setRole] = useState<(typeof roles)[number]>((state?.values?.role as never) ?? 'associate');
  const v = state?.values;
  const label = { associate: t('roles.associate'), munshi: t('roles.munshi'), staff: t('team.roleStaffLabel') };
  const desc = { associate: t('team.roleAssociate'), munshi: t('team.roleMunshi'), staff: t('team.roleStaff') };
  if (state?.link) {
    return <SharePanel link={state.link} phone={state.values?.phone ?? ''} text={state.values?.text ?? ''} />;
  }

  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <Field id="inv-name" label={t('team.name')}>
        <input
          id="inv-name"
          name="name"
          required
          defaultValue={v?.name}
          placeholder={t('team.namePlaceholder')}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      <Field id="inv-phone" label={t('team.phone')}>
        <input
          id="inv-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          defaultValue={v?.phone}
          placeholder={t('login.phonePlaceholder')}
          className={`${inputClass} h-12 text-[16px]`}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1.5 text-[14px] font-semibold">{t('team.role')}</legend>
        {roles.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3 has-checked:border-2 has-checked:border-accent has-checked:bg-accent-soft"
          >
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => setRole(r)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{label[r]}</span>
              <span className="text-[13px] text-muted">{desc[r]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === 'associate' && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1.5 text-[14px] font-semibold">{t('team.scope')}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-2 p-1">
            {(['all', 'assigned'] as const).map((s) => (
              <label
                key={s}
                className="flex h-10 cursor-pointer items-center justify-center rounded-[9px] text-[15px] text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input
                  type="radio"
                  name="caseScope"
                  value={s}
                  defaultChecked={(v?.caseScope ?? 'assigned') === s}
                  className="sr-only"
                />
                {s === 'all' ? t('team.scopeAll') : t('team.scopeAssigned')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-[13px] text-muted">{bySms ? t('team.inviteNote') : t('team.inviteNoteLink')}</p>
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1 h-[50px] text-[16px]">
        {t('team.send')}
      </PrimaryButton>
    </ActionForm>
  );
}

/**
 * No SMS gateway yet: the owner sends the invitation from their own phone. The link is shown once,
 * here, to the owner; anyone who has it can open the invitation, but only with the invited number.
 */
function SharePanel({ link, phone, text }: { link: string; phone: string; text: string }) {
  const t = useTranslations('team');
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/^\+/, '');
  const button = 'flex h-12 items-center justify-center rounded-control text-[16px] font-semibold';
  return (
    <section role="status" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-[17px] font-semibold">{t('shareTitle')}</h2>
      <p className="text-[14px] leading-relaxed text-muted">{t('shareBody')}</p>
      <a
        href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
        className={`${button} bg-accent text-on-accent`}
      >
        {t('shareWhatsApp')}
      </a>
      <a href={`sms:${phone}?body=${encodeURIComponent(text)}`} className={`${button} border border-border`}>
        {t('shareSms')}
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className={`${button} border border-border`}
      >
        {copied ? t('shareCopied') : t('shareCopy')}
      </button>
      <p className="text-[13px] break-all text-muted">{link}</p>
      <Link href="/team" className="flex min-h-11 items-center justify-center text-[14px] font-semibold text-accent">
        {t('shareDone')}
      </Link>
    </section>
  );
}
