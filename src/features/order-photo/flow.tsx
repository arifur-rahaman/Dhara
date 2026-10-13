'use client';

import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/form';
import { finishUpload, startUpload } from '@/features/documents/actions';
import { put } from '@/features/documents/upload';
import { readOrderPhoto, saveOrderReading, type ReadPhotoResult } from './actions';

type CaseOption = { id: string; label: string; court: string };
const field = `${inputClass} h-12 text-[16px] px-3.5`;

/** The photo is made small on the phone before it is read (about 1800px, JPEG): enough for a written order. */
async function shrink(file: File): Promise<{ file: File; dataUrl: string } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.78));
    if (!blob) return null;
    const small = new File([blob], 'order.jpg', { type: 'image/jpeg' });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(small);
    });
    return { file: small, dataUrl };
  } catch {
    return null;
  }
}

/**
 * Order photo → next date (OrderPhoto design, F37): pick the case, take the photo, check what the AI read,
 * then save. Nothing is saved until the person presses Save; the date and summary can be edited first.
 */
export function OrderPhotoFlow({
  cases,
  initialCaseId,
  today,
}: {
  cases: CaseOption[];
  initialCaseId?: string;
  today: string;
}) {
  const t = useTranslations('orderPhoto');
  const format = useFormatter();
  const router = useRouter();
  const fileId = useId();
  const [caseId, setCaseId] = useState(initialCaseId ?? cases[0]?.id ?? '');
  const [photo, setPhoto] = useState<{ file: File; dataUrl: string } | null>(null);
  const [reading, setReading] = useState<Extract<ReadPhotoResult, { ok: true }> | null>(null);
  const [date, setDate] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPhoto = (file: File | undefined) => {
    setError(null);
    setReading(null);
    if (!file || !caseId) return;
    startTransition(async () => {
      const small = await shrink(file);
      if (!small) return setError('badImage');
      setPhoto(small);
      const result = await readOrderPhoto({ caseId, image: small.dataUrl });
      if (!result.ok) return setError(result.error);
      setReading(result);
      setDate(result.nextDate ?? '');
      setSummary(result.summary);
    });
  };

  const onSave = () => {
    if (!photo || !reading) return;
    setError(null);
    startTransition(async () => {
      if (!date || date < today) return setError('dateInvalid');
      const started = await startUpload({
        caseId,
        kind: 'order',
        title: t('documentTitle', {
          date: format.dateTime(new Date(`${today}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' }),
        }),
        fileName: photo.file.name,
        contentType: 'image/jpeg',
        size: photo.file.size,
        confidential: false,
      });
      const uploaded =
        started.ok && (await put(started.url, photo.file)) && (await finishUpload(started.documentId)).ok;
      if (!uploaded) return setError('uploadFailed');
      const saved = await saveOrderReading({ caseId, date, summary });
      if (!saved.ok) return setError(saved.error);
      router.push(`/cases/${caseId}?saved=${date}`);
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Field id="photo-case" label={t('case')}>
        <select
          id="photo-case"
          value={caseId}
          onChange={(e) => {
            setCaseId(e.target.value);
            setReading(null);
            setPhoto(null);
          }}
          className={field}
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} · {c.court}
            </option>
          ))}
        </select>
      </Field>

      {photo ? (
        // A local preview of the photo just taken; next/image does not apply to data URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.dataUrl}
          alt={t('photoAlt')}
          className="max-h-[280px] w-full rounded-card border border-border object-contain"
        />
      ) : null}

      <label
        htmlFor={fileId}
        className="flex h-[52px] cursor-pointer items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
      >
        {photo ? t('retake') : t('take')}
        <input
          id={fileId}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={pending || !caseId}
          onChange={(e) => onPhoto(e.target.files?.[0])}
          className="sr-only"
        />
      </label>

      {pending && !reading && (
        <p role="status" className="text-[14px] text-muted">
          {t('reading')}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
          {t(`errors.${error}`)}
        </p>
      )}

      {reading && (
        <section
          aria-labelledby="photo-found"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="photo-found" className="text-[16px] font-semibold">
              {t('found')}
            </h2>
            <span className="rounded-full bg-lock-bg px-2.5 py-[3px] text-[12px] font-semibold text-lock-text">
              {t('check')}
            </span>
          </div>
          <Field
            id="photo-date"
            label={t('nextDate')}
            hint={
              reading.dateConfidence !== 'clear' && (
                <p className="text-[13px] text-lock-text">{reading.nextDate ? t('dateUnsure') : t('dateNone')}</p>
              )
            }
          >
            <input
              id="photo-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </Field>
          <Field id="photo-summary" label={t('summary')}>
            <textarea
              id="photo-summary"
              rows={2}
              maxLength={500}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`${inputClass} h-auto py-3 text-[15px]`}
            />
          </Field>
          <p
            className={`text-[14px] font-semibold ${reading.caseMatch === 'no' ? 'text-lock-text' : reading.caseMatch === 'yes' ? 'text-ok' : 'text-muted'}`}
          >
            {t(`caseMatch.${reading.caseMatch}`)}
          </p>
          <p className="text-[13px] leading-relaxed text-muted">{t('handwriting')}</p>
          <PrimaryButton type="button" onClick={onSave} pending={pending} disabled={!date}>
            {t('save')}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => setReading(null)} disabled={pending}>
            {t('cancel')}
          </SecondaryButton>
        </section>
      )}
    </div>
  );
}
