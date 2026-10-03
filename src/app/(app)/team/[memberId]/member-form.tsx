'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, FormError, PrimaryButton, SecondaryButton } from '@/components/form';
import { removeMember, updateMember } from '@/features/team/member-actions';

type MemberRole = 'associate' | 'munshi' | 'staff';
const roles: MemberRole[] = ['associate', 'munshi', 'staff'];

/** Role, case scope (P3) and fee visibility (P9) for one member. Same controls as InviteMember. */
export function MemberForm({
  member,
}: {
  member: { id: string; role: MemberRole; caseScope: 'all' | 'assigned'; canSeeFees: boolean };
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateMember, undefined);
  const [role, setRole] = useState<MemberRole>(member.role);
  const label = { associate: t('roles.associate'), munshi: t('roles.munshi'), staff: t('team.roleStaffLabel') };
  const desc = { associate: t('team.roleAssociate'), munshi: t('team.roleMunshi'), staff: t('team.roleStaff') };

  return (
    <ActionForm action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="membershipId" value={member.id} />
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
        <>
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
                    defaultChecked={member.caseScope === s}
                    className="sr-only"
                  />
                  {s === 'all' ? t('team.scopeAll') : t('team.scopeAssigned')}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3">
            <input
              type="checkbox"
              name="canSeeFees"
              defaultChecked={member.canSeeFees}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t('team.feesLabel')}</span>
              <span className="text-[13px] text-muted">{t('team.feesHint')}</span>
            </span>
          </label>
        </>
      )}
      <p className="flex items-start gap-2 rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[13px] text-lock-text">
        {t('team.contactLocked')}
      </p>
      <FormError error={state?.error} />
      <PrimaryButton type="submit" pending={pending} className="mt-1 h-[50px] text-[16px]">
        {t('team.save')}
      </PrimaryButton>
    </ActionForm>
  );
}

/** Removing a member needs an explicit tick, like deleting a case. */
export function RemoveMemberForm({ memberId, name }: { memberId: string; name: string }) {
  const t = useTranslations('team');
  const [state, action, pending] = useActionState(removeMember, undefined);
  return (
    <ActionForm
      action={action}
      className="mt-4 flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
      aria-labelledby="remove-member"
    >
      <h2 id="remove-member" className="text-[16px] font-semibold">
        {t('removeTitle')}
      </h2>
      <p className="text-[14px] text-muted">{t('removeBody', { name })}</p>
      <input type="hidden" name="membershipId" value={memberId} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" name="confirm" className="size-5 shrink-0 accent-[var(--accent)]" />
        {t('removeConfirm')}
      </label>
      <FormError error={state?.error} />
      <SecondaryButton type="submit" pending={pending} className="border-lock-text text-lock-text">
        {t('remove')}
      </SecondaryButton>
    </ActionForm>
  );
}
