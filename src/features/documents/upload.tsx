'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FormError, PrimaryButton, SecondaryButton, inputClass } from '@/components/form';
import { Icon } from '@/components/icons';
import { finishUpload, startUpload } from './actions';
import { MAX_UPLOAD_BYTES, isAllowedType } from './files';

type Kind = 'order' | 'pleading' | 'other';
const MAX_SIDE = 2400;

/**
 * Photos are made smaller on the phone before upload (TECH_GUIDE section 13): longest side 2400px, JPEG.
 * Formats the browser cannot open (for example HEIC outside Safari) are refused with a clear message.
 */
export async function compressPhoto(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) return null;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

/** "Scan" (camera) and "Add file" buttons from the Documents design, then a short form before upload. */
export function DocumentUpload({
  caseId,
  defaultKind = 'other',
  canMarkPrivate,
  ordersOnly,
}: {
  caseId: string;
  defaultKind?: Kind;
  canMarkPrivate: boolean;
  ordersOnly: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const id = useId();
  const scanRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    setError(undefined);
    setDone(false);
    if (!chosen) return;
    let ready: File | null = chosen;
    if (chosen.type.startsWith('image/') && chosen.type !== 'image/png') ready = await compressPhoto(chosen);
    if (!ready) return setError('photoFormat');
    if (!isAllowedType(ready.type)) return setError('fileType');
    if (ready.size > MAX_UPLOAD_BYTES) return setError('fileTooBig');
    setFile(ready);
    setTitle(ready.name.replace(/\.[^.]+$/, '').slice(0, 200));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    const started = await startUpload({
      caseId,
      kind: (ordersOnly ? 'order' : String(form.get('kind'))) as Kind,
      title: String(form.get('title') ?? '').trim() || file.name,
      fileName: file.name,
      contentType: file.type as never,
      size: file.size,
      confidential: form.get('confidential') === 'on',
    });
    if (!started.ok) {
      setBusy(false);
      return setError(started.error);
    }
    const sent = await put(started.url, file, setProgress);
    const finished = sent ? await finishUpload(started.documentId) : { ok: false, error: 'uploadFailed' };
    setBusy(false);
    setProgress(null);
    if (!finished.ok) return setError(finished.error ?? 'uploadFailed');
    setFile(null);
    setDone(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={scanRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={pick}
      />
      <input
        ref={fileRef}
        id={`${id}-file`}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t('documents.addFile')}
        onChange={pick}
      />
      {done && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
          {t('documents.uploaded')}
        </p>
      )}
      {!file && <FormError error={error} />}

      {file ? (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <p className="text-[14px] text-muted">
            {t('documents.selected', { name: file.name, size: Math.max(1, Math.round(file.size / 1024)) })}
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-title`} className="text-[14px] font-semibold">
              {t('documents.title')}
            </label>
            <input
              id={`${id}-title`}
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className={`${inputClass} h-12 text-[16px]`}
            />
          </div>
          {!ordersOnly && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-kind`} className="text-[14px] font-semibold">
                {t('documents.kind')}
              </label>
              <select
                id={`${id}-kind`}
                name="kind"
                defaultValue={defaultKind}
                className={`${inputClass} h-12 text-[16px]`}
              >
                {(['order', 'pleading', 'other'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`documents.kinds.${k}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canMarkPrivate && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
              <input type="checkbox" name="confidential" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{t('documents.markPrivate')}</span>
                <span className="text-[13px] text-muted">{t('documents.privateNote')}</span>
              </span>
            </label>
          )}
          {progress !== null && (
            <progress value={progress} max={100} aria-label={t('documents.uploading')} className="h-2 w-full" />
          )}
          <FormError error={error} />
          <div className="grid grid-cols-2 gap-2.5">
            <SecondaryButton type="button" onClick={() => setFile(null)} disabled={busy}>
              {t('documents.cancel')}
            </SecondaryButton>
            <PrimaryButton type="submit" pending={busy} className="h-12 text-[16px]">
              {busy ? t('documents.uploading') : t('documents.upload')}
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => scanRef.current?.click()}
            className="flex h-[50px] items-center justify-center gap-2 rounded-control bg-accent text-[15px] font-semibold text-on-accent"
          >
            <Icon name="photo" size={20} />
            {t('documents.scan')}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-[50px] items-center justify-center gap-2 rounded-control border border-border text-[15px] font-medium"
          >
            <Icon name="documents" size={20} />
            {t('documents.addFile')}
          </button>
        </div>
      )}
    </div>
  );
}
