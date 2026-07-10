// Device-music scanning engine — feature detection, directory recursion,
// file filtering, fingerprinting, metadata extraction, and cancellation.
// Kept out of any React component so it stays independently testable and so
// DeviceLibraryPage.jsx doesn't have to own this much logic directly.
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

// --- Recursive enumeration ----------------------------------------------------

// Yields { file, relativePath } for every file under a FileSystemDirectoryHandle,
// read-only, never descending outside the handle it was given. Aborts cleanly
// via `signal` between files (not mid-file) so cancellation is prompt without
// corrupting anything already collected.
export async function* iterateDirectoryFiles(dirHandle, { signal, pathPrefix = "" } = {}) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (signal?.aborted) throw new ScanCancelledError();

    const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;
    if (handle.kind === "file") {
      const file = await handle.getFile();
      yield { file, relativePath, fileHandle: handle };
    } else if (handle.kind === "directory") {
      yield* iterateDirectoryFiles(handle, { signal, pathPrefix: relativePath });
    }
  }
}

// Normalizes a browser FileList (webkitdirectory input, plain multi-file
// input, or a drag-and-drop DataTransfer's files) into the same
// { file, relativePath } shape the directory-picker path produces.
export const filesFromFileList = (fileList) =>
  Array.from(fileList || []).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
    fileHandle: null,
  }));

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
// waiting on a full read.
export const buildFastFingerprint = async ({ relativePath, filename, sizeBytes, lastModified }) => {
  const key = `${relativePath}|${filename}|${sizeBytes}|${lastModified}`;
  return sha256Hex(key);
};

// Stronger, content-based fingerprint for genuine duplicate detection (e.g.
// the same audio under two different filenames/folders). Reads the whole
// file into memory once — callers are responsible for bounding how many of
// these run concurrently (see createConcurrencyLimiter below).
export const computeContentHash = async (file) => sha256Hex(await file.arrayBuffer());

// --- Metadata extraction -----------------------------------------------------

const titleFromFilename = (filename) => filename.replace(/\.[^./\\]+$/, "").trim() || null;
const folderNameFromPath = (relativePath) => {
  const parts = relativePath.split("/");
  return parts.length > 1 ? parts[parts.length - 2] : null;
};

// Extracts what it can via music-metadata's browser-compatible parseBlob,
// then applies the documented fallback rules — local playback never
// requires manually entered metadata.
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

// --- Concurrency-limited batch runner -----------------------------------------

// A minimal, dependency-free concurrency limiter — runs `items` through
// `worker` with at most `limit` in flight at once, calling `onItemDone` as
// each settles (success or failure) so callers can update UI incrementally
// without waiting for the whole batch. Cooperatively cancellable via `signal`.
export const runWithConcurrency = async (items, worker, { limit = 4, signal, onItemDone } = {}) => {
  let cursor = 0;
  const results = new Array(items.length);

  const runNext = async () => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        results[index] = { error: err };
      }
      onItemDone?.(results[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
};

export const SUPPORTED_AUDIO_EXTENSIONS = SUPPORTED_EXTENSIONS;
export const MAX_SCAN_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;
