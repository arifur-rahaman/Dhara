'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionForm, Field, FormError, PrimaryButton, inputClass } from '@/components/form';
import { createCase, updateCase } from '@/features/cases/actions';

type Option = { value: string; label: string };

const caseTypes = ['civil', 'criminal_cr', 'criminal_gr', 'writ', 'family', 'money_loan', 'other'] as const;
const field = `${inputClass} h-12 text-[16px] px-3.5`;

/** AddCase design. Number and year are kept as typed (Bangla or English digits). */
export function CaseForm({
  supremeCourts,
  districtCourts,
  clients,
  assignees,
  today,
  defaultCourtId,
  edit,
}: {
  supremeCourts: Option[];
  districtCourts: Option[];
  clients: string[];
  assignees: Option[] | null;
  today: string;
  defaultCourtId?: string;
  /** Edit mode: the case's current values. Client and next date are changed elsewhere. */
  edit?: { caseId: string; values: Record<string, string>; canClose: boolean };
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(edit ? updateCase : createCase, undefined);
  const v = state?.values ?? edit?.values;

  return (
    <ActionForm action={action} className="flex flex-col gap-2.5" noValidate>
      {edit && <input type="hidden" name="caseId" value={edit.caseId} />}
      <Field id="case-type" label={t('caseForm.type')}>
        <select id="case-type" name="type" defaultValue={v?.type ?? 'civil'} className={field}>
          {caseTypes.map((ct) => (
            <option key={ct} value={ct}>
              {t(`caseTypeOption.${ct}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="case-no" label={t('caseForm.number')}>
          <input
            id="case-no"
            name="number"
            required
            defaultValue={v?.number}
            placeholder={t('caseForm.numberPlaceholder')}
            className={field}
          />
        </Field>
        <Field id="case-year" label={t('caseForm.year')}>
          <input
            id="case-year"
            name="year"
            required
            inputMode="numeric"
            maxLength={4}
            defaultValue={v?.year}
            placeholder={t('caseForm.yearPlaceholder')}
            className={field}
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field id="case-court" label={t('caseForm.court')}>
          <select
            id="case-court"
            name="courtId"
            required
            defaultValue={v?.courtId ?? defaultCourtId ?? districtCourts[0]?.value}
            className={field}
          >
            <optgroup label={t('caseForm.districtGroup')}>
              {districtCourts.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('caseForm.supremeGroup')}>
              {supremeCourts.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field id="case-court-no" label={t('caseForm.courtNo')}>
          <input
            id="case-court-no"
            name="courtNo"
            defaultValue={v?.courtNo}
            placeholder={t('caseForm.courtNoPlaceholder')}
            className={field}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-[14px] font-semibold">{t('caseForm.ourSide')}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-2 p-1">
          {(['plaintiff', 'defendant'] as const).map((side) => (
            <label
              key={side}
              className="flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="ourSide"
                value={side}
                defaultChecked={(v?.ourSide ?? 'plaintiff') === side}
                className="sr-only"
              />
              {t(`ourSide.${side}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {!edit && (
        <Field id="case-client" label={t('caseForm.client')}>
          <input
            id="case-client"
            name="clientName"
            list="case-client-names"
            autoComplete="off"
            defaultValue={v?.clientName}
            placeholder={t('caseForm.clientPlaceholder')}
            className={field}
          />
          <datalist id="case-client-names">
            {clients.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
      )}
      {assignees && (
        <Field id="case-assignee" label={t('caseForm.assignee')}>
          <select
            id="case-assignee"
            name="assignee"
            defaultValue={v?.assignee ?? assignees[0]?.value}
            className={field}
          >
            {assignees.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!edit && (
        <Field id="case-date" label={t('caseForm.nextDate')}>
          <input id="case-date" name="nextDate" type="date" min={today} defaultValue={v?.nextDate} className={field} />
        </Field>
      )}
      {edit?.canClose && (
        <Field id="case-status" label={t('caseForm.status')}>
          <select id="case-status" name="status" defaultValue={v?.status ?? 'active'} className={field}>
            <option value="active">{t('caseForm.statusActive')}</option>
            <option value="disposed">{t('caseForm.statusDisposed')}</option>
          </select>
        </Field>
      )}
      <details className="group pt-0.5" open={!!(v?.partiesText || v?.opposingCounsel || v?.note)}>
        <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-accent">
          {t('caseForm.more')}
        </summary>
        <div className="flex flex-col gap-2.5 pt-1">
          <Field id="case-parties" label={t('caseForm.parties')}>
            <input
              id="case-parties"
              name="partiesText"
              defaultValue={v?.partiesText}
              placeholder={t('caseForm.partiesPlaceholder')}
              className={field}
            />
          </Field>
          <Field id="case-opposing" label={t('caseForm.opposingCounsel')}>
            <input id="case-opposing" name="opposingCounsel" defaultValue={v?.opposingCounsel} className={field} />
          </Field>
          <Field id="case-note" label={t('caseForm.note')}>
            <textarea
              id="case-note"
              name="note"
              rows={3}
              defaultValue={v?.note}
              className={`${inputClass} h-auto py-3 text-[15px]`}
            />
          </Field>
        </div>
      </details>
      {!edit && (
        <Link
          href="/cases/import"
          className="flex min-h-11 items-center text-[14px] text-muted underline-offset-2 hover:underline"
        >
          {t('import.addCaseLink')}
        </Link>
      )}
      <FormError error={state?.error} />
      <div className="sticky bottom-[calc(var(--spacing-tabbar)+8px)] mt-2 md:static">
        <PrimaryButton type="submit" pending={pending} className="h-[50px] w-full text-[16px]">
          {t('caseForm.save')}
        </PrimaryButton>
      </div>
    </ActionForm>
  );
}
