type HeaderBgMeta = {
  enabled: boolean;
  opacity: number;
  blur: number;
  preset: string;
  updatedAt: number;
};

const DB_NAME = 'tscc-backgrounds';
const STORE = 'header';
const KEY = 'image';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const withStore = async (mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    fn(store);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const BackgroundStorage = {
  async getHeaderImage(): Promise<Blob | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  },
  async setHeaderImage(blob: Blob) {
    await withStore('readwrite', (store) => {
      store.put(blob, KEY);
    });
  },
  async clearHeaderImage() {
    await withStore('readwrite', (store) => {
      store.delete(KEY);
    });
  },
};

export type { HeaderBgMeta };
