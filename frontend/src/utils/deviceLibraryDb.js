const DB_NAME = "rockstar-device-library";
const DB_VERSION = 1;
const STORE_NAME = "directoryHandles";
const RECORD_KEY = "selected";

const isSupported = () => typeof indexedDB !== "undefined";

const openDb = () =>
  new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

// Stores only the handle + safe display metadata — never any file contents,
// never an absolute filesystem path (FileSystemDirectoryHandle carries no
// such thing itself; we only ever keep its display name).
export const saveDirectoryHandle = async (handle, { name } = {}) => {
  if (!isSupported()) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: RECORD_KEY, handle, name: name || handle.name, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const getSavedDirectoryHandle = async () => {
  if (!isSupported()) return null;
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  } catch {
    return null;
  }
};

export const clearSavedDirectoryHandle = async () => {
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Nothing meaningful to recover from here.
  }
};
