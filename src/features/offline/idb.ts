'use client';

/**
 * The phone's offline store (TECH_GUIDE section 11): the latest snapshot and the outbox.
 * Plain IndexedDB; the data is small and the API surface we need is four calls.
 */
import type { OfflineSnapshot, OutboxItem } from './types';

const DB = 'dhara-offline';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('snapshot')) db.createObjectStore('snapshot');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const readSnapshot = () => run<OfflineSnapshot | undefined>('snapshot', 'readonly', (s) => s.get('current'));
export const writeSnapshot = (snap: OfflineSnapshot) => run('snapshot', 'readwrite', (s) => s.put(snap, 'current'));
export const outboxAll = () => run<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll());
export const outboxAdd = (item: OutboxItem) => run('outbox', 'readwrite', (s) => s.put(item));
export const outboxRemove = (key: string) => run('outbox', 'readwrite', (s) => s.delete(key));

/** Everything this phone kept for offline use, removed on sign-out (shared phones). */
export function clearOfflineData() {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

export const OUTBOX_EVENT = 'dhara-outbox-changed';
export const notifyOutboxChanged = () => window.dispatchEvent(new Event(OUTBOX_EVENT));
