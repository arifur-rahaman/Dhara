'use client';

import { finishUpload, startUpload } from '@/features/documents/actions';
import { notifyOutboxChanged, outboxAll, outboxRemove, writeSnapshot } from './idb';
import type { OfflineSnapshot, SyncResult } from './types';

export type FlushReport = { sent: number; conflicts: string[]; failed: number };

/** Refreshes the offline snapshot and the cached offline page while online. */
export async function refreshSnapshot() {
  const res = await fetch('/api/offline/snapshot', { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) return null;
  const snap = (await res.json()) as OfflineSnapshot;
  await writeSnapshot(snap);
  navigator.serviceWorker?.controller?.postMessage({ type: 'cache-offline-page' });
  return snap;
}

function put(url: string, file: Blob) {
  return fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }).then((r) => r.ok);
}

/**
 * Sends queued changes oldest first. Accepted, already-applied and refused items leave the outbox;
 * anything that failed because of the network stays for the next try.
 */
export async function flushOutbox(): Promise<FlushReport> {
  const items = (await outboxAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const report: FlushReport = { sent: 0, conflicts: [], failed: 0 };
  const writes = items.filter((i) => i.kind !== 'orderPhoto');
  if (writes.length) {
    const res = await fetch('/api/offline/sync', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: writes.map(({ key, kind, payload }) => ({ key, kind, payload })) }),
    });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const { results } = (await res.json()) as { results: SyncResult[] };
    for (const r of results) {
      const it = writes.find((w) => w.key === r.key);
      if (r.result === 'exists' && it) report.conflicts.push(it.label);
      if (r.result === 'ok' || r.result === 'exists') report.sent++;
      else report.failed++;
      await outboxRemove(r.key);
    }
  }
  for (const it of items) {
    if (it.kind !== 'orderPhoto') continue;
    const p = it.payload;
    const started = await startUpload({
      caseId: p.caseId,
      kind: 'order',
      title: p.title,
      fileName: p.fileName,
      contentType: p.file.type as 'image/jpeg',
      size: p.file.size,
      confidential: false,
    });
    if (!started.ok) {
      report.failed++;
      await outboxRemove(it.key);
      continue;
    }
    if (!(await put(started.url, p.file))) throw new Error('upload');
    const done = await finishUpload(started.documentId);
    if (done.ok) report.sent++;
    else report.failed++;
    await outboxRemove(it.key);
  }
  if (items.length) notifyOutboxChanged();
  return report;
}
