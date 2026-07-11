// Device-music scanning engine — feature detection, directory recursion,
// file filtering, fingerprinting, metadata extraction, and cancellation.
// Kept out of any React component so it stays independently testable and so
// DeviceLibraryPage.jsx doesn't have to own this much logic directly.
//
// The core design constraint: a large folder must never be fully read into
// memory before anything shows up on screen. Directory recursion yields one
// file at a time, and metadata extraction runs behind a small bounded queue
// that callers can push into incrementally while discovery is still running.
//
// music-metadata's parsers (~130KB gzipped) are loaded lazily via a dynamic
// import rather than a static one — DeviceLibraryProvider sits in the
// always-mounted provider tree (App.jsx), so a static import would ship that
// weight to every visitor, not just the ones who actually open Device Music.
let musicMetadataModulePromise = null;
const loadMusicMetadata = () => {
  musicMetadataModulePromise = musicMetadataModulePromise || import("music-metadata");
  return musicMetadataModulePromise;
};

const SUPPORTED_EXTENSIONS = ["mp3", "wav", "m4a", "mp4", "ogg", "opus", "flac", "aac", "webm"];
const SUPPORTED_MIME_PREFIXES = ["audio/"];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // sanity bound — not a hard product requirement, just a safety cap

export const isDirectoryPickerSupported = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export const isFileSystemAccessPersistSupported = () =>
  typeof window !== "undefined" &&
  typeof FileSystemHandle !== "undefined" &&
  typeof FileSystemHandle.prototype?.queryPermission === "function";

// --- Directory picking (primary method) -------------------------------------

export class ScanCancelledError extends Error {
  constructor() {
    super("Scan was cancelled.");
    this.name = "ScanCancelledError";
  }
}

// Returns the picked directory handle, or null if the user cancelled — never
// throws for a cancellation, per the "user cancellation is not an error" rule.
export const pickDirectory = async () => {
  if (!isDirectoryPickerSupported()) return null;
  try {
    return await window.showDirectoryPicker({ id: "rockstar-music-folder", mode: "read", startIn: "music" });
  } catch (err) {
    if (err?.name === "AbortError") return null; // user cancelled the picker
    throw err;
  }
};

export const queryDirectoryPermission = async (handle) => {
  if (!handle || typeof handle.queryPermission !== "function") return "prompt";
  try {
    return await handle.queryPermission({ mode: "read" });
  } catch {
    return "prompt";
  }
};

// Only ever called from a user-initiated action (a click handler), per the
// browser's own requirement for permission re-prompts.
export const requestDirectoryPermission = async (handle) => {
  if (!handle || typeof handle.requestPermission !== "function") return "denied";
  try {
    return await handle.requestPermission({ mode: "read" });
  } catch {
    return "denied";
  }
};

const isHiddenOrSystemName = (name) => name.startsWith(".") || name === "Thumbs.db" || name === "desktop.ini";

// --- Recursive enumeration ----------------------------------------------------

// Yields { file, relativePath, fileHandle } for every file under a
// FileSystemDirectoryHandle, one at a time — read-only, never descending
// outside the handle it was given, never buffering the rest of the tree.
// Aborts cleanly via `signal` between files (not mid-file) so cancellation is
// prompt without corrupting anything already yielded.
export async function* iterateDirectoryFiles(dirHandle, { signal, pathPrefix = "" } = {}) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (signal?.aborted) throw new ScanCancelledError();
    if (isHiddenOrSystemName(name)) continue;

    const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (handle.kind === "file") {
      let file;
      try {
        file = await handle.getFile();
      } catch {
        continue; // unreadable/removed since directory selection — skip, don't abort the whole scan
      }
      yield { file, relativePath, fileHandle: handle };
    } else if (handle.kind === "directory") {
      yield* iterateDirectoryFiles(handle, { signal, pathPrefix: relativePath });
    }
  }
}

// Normalizes a browser FileList (webkitdirectory input, plain multi-file
// input, or a drag-and-drop DataTransfer's files) into the same
// { file, relativePath, fileHandle } shape the directory-picker path
// produces, yielding in small batches with a tick between them so a huge
// selection never blocks the main thread in one synchronous pass.
export async function* iterateFileListEntries(fileList, { signal, chunkSize = 25 } = {}) {
  const files = Array.from(fileList || []);
  for (let i = 0; i < files.length; i += 1) {
    if (signal?.aborted) throw new ScanCancelledError();
    const file = files[i];
    if (!isHiddenOrSystemName(file.name)) {
      yield { file, relativePath: file.webkitRelativePath || file.name, fileHandle: null };
    }
    if ((i + 1) % chunkSize === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

// --- Format support ------------------------------------------------------------

const getExtension = (filename) => (filename.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();

// Two layers: a fast extension/MIME allowlist to filter out obviously
// irrelevant files before doing any work, then an actual browser
// `canPlayType` probe (the only way to know if THIS browser can really
// decode it) once a file has passed the first filter.
export const looksLikeAudioFile = (file) => {
  const ext = getExtension(file.name);
  if (SUPPORTED_EXTENSIONS.includes(ext)) return true;
  return SUPPORTED_MIME_PREFIXES.some((prefix) => file.type?.startsWith(prefix));
};

let probeAudioEl = null;
export const canBrowserPlay = (mimeType) => {
  if (!mimeType) return true; // unknown MIME — let metadata extraction decide instead of rejecting outright
  if (typeof Audio === "undefined") return true; // non-browser test environment
  probeAudioEl = probeAudioEl || new Audio();
  const result = probeAudioEl.canPlayType(mimeType);
  return result === "probably" || result === "maybe";
};

// --- Fingerprinting --------------------------------------------------------

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (input) => {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

// Cheap, immediate identity — computed from safe local metadata only (never
// file contents), so every scanned file gets a stable id right away without
// waiting on a full read. This is the ONLY fingerprint used during the
// initial scan; full content hashing is deliberately not part of this path.
export const buildFastFingerprint = async ({ relativePath, filename, sizeBytes, lastModified }) => {
  const key = `${relativePath}|${filename}|${sizeBytes}|${lastModified}`;
  return sha256Hex(key);
};

// Stronger, content-based hash for genuine duplicate detection at import
// time (server-side is authoritative there). Reads the whole file into
// memory once — never called during the initial local scan, only from the
// explicit import flow.
export const computeContentHash = async (file) => sha256Hex(await file.arrayBuffer());

// --- Metadata extraction -----------------------------------------------------

export const titleFromFilename = (filename) => filename.replace(/\.[^./\\]+$/, "").trim() || null;
const folderNameFromPath = (relativePath) => {
  const parts = relativePath.split("/");
  return parts.length > 1 ? parts[parts.length - 2] : null;
};

// Extracts what it can via music-metadata's browser-compatible parseBlob,
// then applies the documented fallback rules — local playback never
// requires manually entered metadata, and a parse failure never throws.
export const extractTrackMetadata = async (file, relativePath) => {
  const fallbackTitle = titleFromFilename(file.name);
  const fallbackAlbum = folderNameFromPath(relativePath);

  let parsed;
  try {
    const { parseBlob } = await loadMusicMetadata();
    parsed = await parseBlob(file, { duration: true, skipCovers: false });
  } catch {
    return {
      title: fallbackTitle || "Unknown Track",
      artist: "Unknown Artist",
      album: fallbackAlbum || "Unknown Album",
      genres: [],
      durationSeconds: null,
      codec: null,
      container: null,
      bitrate: null,
      artworkBlob: null,
      metadataError: true,
    };
  }

  const common = parsed.common || {};
  const format = parsed.format || {};
  const { selectCover } = await loadMusicMetadata();
  const cover = selectCover(common.picture);

  return {
    title: common.title || fallbackTitle || "Unknown Track",
    artist: common.artist || common.albumartist || "Unknown Artist",
    album: common.album || fallbackAlbum || "Unknown Album",
    trackNumber: common.track?.no ?? null,
    discNumber: common.disk?.no ?? null,
    releaseYear: common.year ?? null,
    genres: Array.isArray(common.genre) ? common.genre : [],
    durationSeconds: Number.isFinite(format.duration) ? format.duration : null,
    codec: format.codec || null,
    container: format.container || null,
    bitrate: Number.isFinite(format.bitrate) ? format.bitrate : null,
    artworkBlob: cover ? new Blob([cover.data], { type: cover.format }) : null,
    metadataError: false,
  };
};

// --- Incremental, bounded-concurrency job queue -------------------------------

// A dependency-free queue that lets a caller `push()` jobs in *as they are
// discovered* rather than handing over a complete array up front. At most
// `limit` jobs run concurrently; `onSettled` fires per-job as soon as it
// finishes (success or failure) so a single corrupt file never blocks or
// aborts the rest of the batch. Cooperatively cancellable via `signal` —
// aborting stops new jobs from starting but does not reach into a job that
// is already mid-flight.
export function createJobQueue({ limit = 3, signal, onSettled } = {}) {
  const pending = [];
  const waiters = [];
  let closed = false;
  let activeWorkers = 0;
  const idleWaiters = [];

  const wake = () => {
    while (waiters.length) waiters.shift()();
  };

  signal?.addEventListener("abort", wake, { once: true });

  // Once aborted, any items still sitting in `pending` were deliberately
  // never started and never will be — they must not count against "idle",
  // or a cancellation with more queued items than workers could drain in
  // time would leave `waitIdle()` waiting forever for a queue length that
  // can never reach zero.
  const isSettled = () => activeWorkers === 0 && (pending.length === 0 || signal?.aborted);

  const settleIdleIfDone = () => {
    if (isSettled()) {
      while (idleWaiters.length) idleWaiters.shift()();
    }
  };

  const runWorker = async () => {
    activeWorkers += 1;
    while (!signal?.aborted) {
      if (pending.length === 0) {
        if (closed) break;
        await new Promise((resolve) => waiters.push(resolve));
        continue;
      }
      const job = pending.shift();
      try {
        const result = await job.task();
        onSettled?.(null, result, job.meta);
      } catch (err) {
        onSettled?.(err, null, job.meta);
      }
    }
    activeWorkers -= 1;
    settleIdleIfDone();
  };

  const workers = [];
  const ensureWorkers = () => {
    while (workers.length < limit && !signal?.aborted) {
      workers.push(runWorker());
    }
  };

  return {
    push(task, meta) {
      if (signal?.aborted || closed) return;
      pending.push({ task, meta });
      ensureWorkers();
      wake();
    },
    close() {
      closed = true;
      wake();
    },
    get pendingCount() {
      return pending.length;
    },
    async waitIdle() {
      if (isSettled()) return;
      await new Promise((resolve) => idleWaiters.push(resolve));
    },
  };
}

export const SUPPORTED_AUDIO_EXTENSIONS = SUPPORTED_EXTENSIONS;
export const MAX_SCAN_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;
