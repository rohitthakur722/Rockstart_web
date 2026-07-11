const DB_NAME = "rockstar-device-library";
const DB_VERSION = 2;
const STORE_NAME = "directoryHandles";
const METADATA_STORE_NAME = "metadataCache";
const RECORD_KEY = "selected";

// Bump this whenever the shape of cached metadata records changes — every
// existing cache entry is then treated as a miss and safely re-parsed,
// rather than risking a stale/mismatched shape being read back.
const METADATA_CACHE_VERSION = 1;

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
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        db.createObjectStore(METADATA_STORE_NAME, { keyPath: "fingerprint" });
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

// --- Metadata cache (keyed by fast fingerprint) -----------------------------
//
// Speeds up rescans by skipping re-parsing of files that haven't changed.
// The fingerprint already encodes relative path + filename + size +
// lastModified, so any real change to the file naturally produces a
// different key — there is no separate staleness check to get wrong.
//
// Only ever stores the safe display fields below. Never the audio binary,
// an object URL, an absolute path, or any credential/token — a cache-read
// failure is always treated as a miss, never a fatal error.
const SAFE_METADATA_FIELDS = [
  "title",
  "artist",
  "album",
  "trackNumber",
  "releaseYear",
  "genres",
  "durationSeconds",
  "codec",
  "container",
  "bitrate",
  "hasArtwork",
];

const pickSafeFields = (fields) => {
  const safe = {};
  SAFE_METADATA_FIELDS.forEach((key) => {
    if (fields[key] !== undefined) safe[key] = fields[key];
  });
  return safe;
};

export const getCachedTrackMetadata = async (fingerprint) => {
  if (!isSupported()) return null;
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE_NAME, "readonly");
      const req = tx.objectStore(METADATA_STORE_NAME).get(fingerprint);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record || record.cacheVersion !== METADATA_CACHE_VERSION) return null;
    return pickSafeFields(record);
  } catch {
    return null; // cache failure is always nonfatal — caller just re-parses
  }
};

export const putCachedTrackMetadata = async (fingerprint, fields) => {
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE_NAME, "readwrite");
      tx.objectStore(METADATA_STORE_NAME).put({
        fingerprint,
        cacheVersion: METADATA_CACHE_VERSION,
        ...pickSafeFields(fields),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Nonfatal — the track just won't benefit from the cache next time.
  }
};
