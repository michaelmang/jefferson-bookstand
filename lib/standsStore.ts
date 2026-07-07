/**
 * Persists named "stands" (a full set of five rest assignments, PDF bytes
 * included, plus the room background and audio settings) in IndexedDB, so a
 * daily or monthly stand survives reloads.
 */
import type { AudioSettings } from "./standState";

export type StoredSlot = { name: string; blob: Blob } | null;
export type StandSummary = {
  name: string;
  savedAt: number;
  /** The posted stand this save was published as, if any. */
  postedId?: number | null;
};
export type StoredStand = StandSummary & {
  slots: StoredSlot[];
  /** Absent on stands saved before rooms/audio became part of the state. */
  background?: string;
  audio?: AudioSettings;
};

const DB_NAME = "jefferson-bookstand";
const STORE = "stands";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export function saveStand(stand: StoredStand): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(stand));
}

export async function listStands(): Promise<StandSummary[]> {
  const all = await withStore("readonly", (store) => store.getAll() as IDBRequest<StoredStand[]>);
  return all
    .map(({ name, savedAt, postedId }) => ({ name, savedAt, postedId: postedId ?? null }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function getStand(name: string): Promise<StoredStand | undefined> {
  return withStore("readonly", (store) => store.get(name) as IDBRequest<StoredStand | undefined>);
}

export function deleteStand(name: string): Promise<undefined> {
  return withStore("readwrite", (store) => store.delete(name));
}

/** Records (or clears) which posted stand a saved stand was published as. */
export async function setStandPostedId(name: string, postedId: number | null): Promise<void> {
  const stand = await getStand(name);
  if (!stand) return;
  await saveStand({ ...stand, postedId });
}
