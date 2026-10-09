'use client';

import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/form';
import { commitImport, previewImport, type CommitResult } from './actions';
import {
  caseTypes,
  guessMapping,
  importFields,
  sides,
  type CaseType,
  type ImportField,
  type Mapping,
  type Side,
} from './fields';
import { readSheet, type Sheet } from './read-file';
import type { PreviewRow } from './server';

type Option = { value: string; label: string };
const field = `${inputClass} h-12 text-[16px] px-3.5`;
/** Server actions accept about 1 MB; leave room for the rest of the request. */
const MAX_PAYLOAD = 900_000;

/**
 * Excel or CSV import (F20): 1 choose a file, 2 say which column is which, 3 check the preview, 4 done.
 * Duplicates and rows with problems are listed and skipped; nothing is saved before step 3's button.
 */
export function ImportWizard({
  supremeCourts,
  districtCourts,
  assignees,
}: {
  supremeCourts: Option[];
  districtCourts: Option[];
  assignees: Option[] | null;
}) {
  const t = useTranslations('import');
  const tc = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const fileId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Mapping>({});
  const [courtId, setCourtId] = useState('');
  const [type, setType] = useState<CaseType>('civil');
  const [ourSide, setOurSide] = useState<Side>('plaintiff');
  const [assignee, setAssignee] = useState(assignees?.[0]?.value ?? '');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [done, setDone] = useState<Extract<CommitResult, { ok: true }> | null>(null);

  /** Only the mapped columns are sent, renumbered from 0. */
  const payload = () => {
    const used = importFields.filter((f) => mapping[f] !== undefined);
    const columns = used.map((f) => mapping[f]!);
    const compact: Mapping = Object.fromEntries(used.map((f, i) => [f, i]));
    return {
      rows: sheet!.rows.map((r) => columns.map((c) => r[c] ?? '')),
      mapping: compact,
      defaults: { courtId: courtId || null, type, ourSide },
      assignee: assignees ? assignee || null : null,
    };
  };

  const onFile = (file: File | undefined) => {
    setError(null);
    setPreview(null);
    if (!file) return;
    startTransition(async () => {
      const result = await readSheet(file);
      if (!result.ok) {
        setSheet(null);
        setError(`read.${result.error}`);
        return;
      }
      setFileName(file.name);
      setSheet(result.sheet);
      setMapping(guessMapping(result.sheet.headers));
    });
  };

  const onPreview = () => {
    setError(null);
    if (mapping.number === undefined) return setError('needNumber');
    const body = payload();
    if (new TextEncoder().encode(JSON.stringify(body)).length > MAX_PAYLOAD) return setError('tooBig');
    startTransition(async () => {
      const result = await previewImport(body);
      if (!result.ok) return setError(`server.${result.error}`);
      setPreview(result.rows);
    });
  };

  const onImport = () => {
    setError(null);
    startTransition(async () => {
      const result = await commitImport(payload());
      if (!result.ok) return setError(`server.${result.error}`);
      setDone(result);
    });
  };

  if (done) {
    return (
      <section
        aria-labelledby="import-done"
        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
      >
        <h2 id="import-done" className="text-[18px] font-semibold">
          {t('done.title')}
        </h2>
        <p role="status" className="text-[15px] leading-relaxed">
          {t('done.summary', { cases: done.cases, hearings: done.hearings, clients: done.clients })}
        </p>
        {done.skipped > 0 && <p className="text-[14px] text-muted">{t('done.skipped', { count: done.skipped })}</p>}
        <Link
          href="/cases"
          className="flex h-12 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
        >
          {t('done.open')}
        </Link>
      </section>
    );
  }

  const counts = preview && {
    ok: preview.filter((r) => r.status === 'ok').length,
    duplicate: preview.filter((r) => r.status === 'duplicate').length,
    error: preview.filter((r) => r.status === 'error').length,
  };
  const columnOptions =
    sheet?.headers.map((h, i) => ({ value: String(i), label: h || t('column', { n: i + 1 }) })) ?? [];
  const courtName = (c: PreviewRow['court']) => (c ? (locale === 'bn' ? c.nameBn : c.nameEn) : '');

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="import-step-file"
        className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4"
      >
        <h2 id="import-step-file" className="text-[16px] font-semibold">
          {t('steps.file')}
        </h2>
        <p className="text-[14px] leading-relaxed text-muted">{t('fileHelp')}</p>
        <label htmlFor={fileId} className="text-[14px] font-semibold">
          {t('chooseFile')}
        </label>
        <input
          id={fileId}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-[15px] file:mr-3 file:h-11 file:rounded-control file:border file:border-border file:bg-surface-2 file:px-4 file:text-[15px] file:font-semibold file:text-text"
        />
        {sheet && (
          <p className="text-[14px] text-muted">{t('fileRead', { name: fileName, rows: sheet.rows.length })}</p>
        )}
      </section>

      {sheet && (
        <section
          aria-labelledby="import-step-columns"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
        >
          <h2 id="import-step-columns" className="text-[16px] font-semibold">
            {t('steps.columns')}
          </h2>
          <p className="text-[14px] leading-relaxed text-muted">{t('columnsHelp')}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {importFields.map((f: ImportField) => (
              <Field key={f} id={`map-${f}`} label={t(`fields.${f}`)}>
                <select
                  id={`map-${f}`}
                  value={mapping[f] === undefined ? '' : String(mapping[f])}
                  onChange={(e) => {
                    setPreview(null);
                    setMapping((m) => {
                      const next = { ...m };
                      if (e.target.value === '') delete next[f];
                      else next[f] = Number(e.target.value);
                      return next;
                    });
                  }}
                  className={field}
                >
                  <option value="">{t('notInFile')}</option>
                  {columnOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-muted">{t('noContact')}</p>

          <h3 className="pt-1 text-[15px] font-semibold">{t('fallbacks')}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field id="import-court" label={t('fallbackCourt')}>
              <select
                id="import-court"
                value={courtId}
                onChange={(e) => {
                  setPreview(null);
                  setCourtId(e.target.value);
                }}
                className={field}
              >
                <option value="">{t('noFallbackCourt')}</option>
                <optgroup label={tc('caseForm.districtGroup')}>
                  {districtCourts.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={tc('caseForm.supremeGroup')}>
                  {supremeCourts.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
            <Field id="import-type" label={t('fallbackType')}>
              <select
                id="import-type"
                value={type}
                onChange={(e) => setType(e.target.value as CaseType)}
                className={field}
              >
                {caseTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {tc(`caseTypeOption.${ct}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="import-side" label={t('fallbackSide')}>
              <select
                id="import-side"
                value={ourSide}
                onChange={(e) => setOurSide(e.target.value as Side)}
                className={field}
              >
                {sides.map((s) => (
                  <option key={s} value={s}>
                    {tc(`ourSide.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            {assignees && (
              <Field id="import-assignee" label={t('assignee')}>
                <select
                  id="import-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
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
          </div>
          <SecondaryButton type="button" onClick={onPreview} pending={pending}>
            {t('previewButton')}
          </SecondaryButton>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
          {t(`errors.${error}`)}
        </p>
      )}

      {preview && counts && (
        <section
          aria-labelledby="import-step-preview"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
        >
          <h2 id="import-step-preview" className="text-[16px] font-semibold">
            {t('steps.preview')}
          </h2>
          <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
            <li className="rounded-full bg-ok-bg px-2.5 py-[3px] text-ok">{t('counts.ok', { count: counts.ok })}</li>
            <li className="rounded-full bg-surface-2 px-2.5 py-[3px] text-muted">
              {t('counts.duplicate', { count: counts.duplicate })}
            </li>
            <li className="rounded-full bg-lock-bg px-2.5 py-[3px] text-lock-text">
              {t('counts.error', { count: counts.error })}
            </li>
          </ul>
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t('table.line')}</th>
                  <th className="px-2 py-2 font-semibold">{t('table.case')}</th>
                  <th className="px-2 py-2 font-semibold">{t('table.court')}</th>
                  <th className="px-2 py-2 font-semibold">{t('table.date')}</th>
                  <th className="px-4 py-2 font-semibold">{t('table.result')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.line} className="border-t border-border align-top">
                    <td className="px-4 py-2 text-muted">{format.number(r.line)}</td>
                    <td className="px-2 py-2">
                      {r.number}
                      {r.year && `/${r.year}`}
                      {r.clientName && <span className="block text-[13px] text-muted">{r.clientName}</span>}
                    </td>
                    <td className="px-2 py-2">{courtName(r.court)}</td>
                    <td className="px-2 py-2">
                      {r.nextDate &&
                        format.dateTime(new Date(`${r.nextDate}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' })}
                    </td>
                    <td className="px-4 py-2">
                      {r.status === 'ok' ? (
                        <span className="text-ok">{t('status.ok')}</span>
                      ) : r.status === 'duplicate' ? (
                        <span className="text-muted">{t('status.duplicate')}</span>
                      ) : (
                        <span className="text-lock-text">{r.errors.map((e) => t(`rowErrors.${e}`)).join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PrimaryButton type="button" onClick={onImport} pending={pending} disabled={counts.ok === 0}>
            {t('importButton', { count: counts.ok })}
          </PrimaryButton>
        </section>
      )}
    </div>
  );
}
