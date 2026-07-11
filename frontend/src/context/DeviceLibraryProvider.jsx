import { useCallback, useMemo, useRef, useState } from "react";
import {
  isDirectoryPickerSupported,
  pickDirectory,
  queryDirectoryPermission,
  requestDirectoryPermission,
  iterateDirectoryFiles,
  iterateFileListEntries,
  looksLikeAudioFile,
  canBrowserPlay,
  buildFastFingerprint,
  extractTrackMetadata,
  titleFromFilename,
  createJobQueue,
  ScanCancelledError,
} from "../services/deviceMusicScanner";
import {
  saveDirectoryHandle,
  getSavedDirectoryHandle,
  clearSavedDirectoryHandle,
  getCachedTrackMetadata,
  putCachedTrackMetadata,
} from "../utils/deviceLibraryDb";
import * as songApi from "../api/songApi";
import { extractErrorMessage } from "../api/axiosInstance";
import { DeviceLibraryContext } from "./DeviceLibraryContext";

const METADATA_CONCURRENCY = 3;
const IMPORT_CONCURRENCY = 2;
const ARTWORK_URL_CACHE_LIMIT = 60;

const EMPTY_COUNTERS = {
  discoveredFiles: 0,
  audioCandidates: 0,
  queuedForMetadata: 0,
  readyToPlay: 0,
  unsupported: 0,
  metadataErrors: 0,
  duplicates: 0,
  processed: 0,
  totalSizeBytes: 0,
};

export function DeviceLibraryProvider({ children }) {
  // idle | requesting_permission | discovering | reading_metadata | ready | cancelled | error
  const [scanPhase, setScanPhase] = useState("idle");
  const [counters, setCounters] = useState(EMPTY_COUNTERS);
  const [scanError, setScanError] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [directoryName, setDirectoryName] = useState(null);
  const [permissionState, setPermissionState] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [importSummary, setImportSummary] = useState({ inFlight: 0 });

  const directoryHandleRef = useRef(null);
  const abortControllerRef = useRef(null);
  const jobQueueRef = useRef(null);
  const playbackUrlsRef = useRef(new Map());
  const artworkBlobsRef = useRef(new Map());
  const artworkUrlsRef = useRef(new Map());
  const importCancelledRef = useRef(false);

  const revokeAllArtworkUrls = useCallback(() => {
    for (const url of artworkUrlsRef.current.values()) URL.revokeObjectURL(url);
    artworkUrlsRef.current.clear();
    artworkBlobsRef.current.clear();
  }, []);

  const revokeAllPlaybackUrls = useCallback(() => {
    for (const url of playbackUrlsRef.current.values()) URL.revokeObjectURL(url);
    playbackUrlsRef.current.clear();
  }, []);

  const getPlaybackUrl = useCallback((track) => {
    if (!track?.file) return null;
    const existing = playbackUrlsRef.current.get(track.id);
    if (existing) return existing;
    const url = URL.createObjectURL(track.file);
    playbackUrlsRef.current.set(track.id, url);
    return url;
  }, []);

  // On-demand, bounded object-URL cache for embedded artwork — a blob is
  // stored per track as soon as it's extracted, but the (memory-heavier)
  // object URL itself is only created the first time something actually
  // tries to render it, and the least-recently-used URL is revoked once the
  // cache grows past its cap so a long scan never accumulates hundreds of
  // live URLs.
  const getArtworkUrl = useCallback((id) => {
    const existing = artworkUrlsRef.current.get(id);
    if (existing) {
      artworkUrlsRef.current.delete(id);
      artworkUrlsRef.current.set(id, existing);
      return existing;
    }
    const blob = artworkBlobsRef.current.get(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    artworkUrlsRef.current.set(id, url);
    if (artworkUrlsRef.current.size > ARTWORK_URL_CACHE_LIMIT) {
      const oldestKey = artworkUrlsRef.current.keys().next().value;
      URL.revokeObjectURL(artworkUrlsRef.current.get(oldestKey));
      artworkUrlsRef.current.delete(oldestKey);
    }
    return url;
  }, []);

  const updateTrack = useCallback((id, patch) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  const bumpCounter = useCallback((key, amount = 1) => {
    setCounters((prev) => ({ ...prev, [key]: prev[key] + amount }));
  }, []);

  // --- Scanning ----------------------------------------------------------
  //
  // Single entry point for both the directory-picker path and the
  // FileList path (webkitdirectory input, plain multi-file input, drag and
  // drop) — one pipeline, no divergent scanner implementations. Discovery
  // and metadata extraction share exactly one AbortController, created here,
  // so cancelling genuinely stops both directory recursion/FileList
  // processing AND the metadata queue rather than only one of them.

  const runDiscoveryPipeline = useCallback(
    async ({ kind, source, sourceLabel }) => {
      revokeAllArtworkUrls();
      revokeAllPlaybackUrls();
      setTracks([]);
      setSelectedIds(new Set());
      setScanError(null);
      setCounters(EMPTY_COUNTERS);
      setDirectoryName(sourceLabel ?? null);
      setScanPhase("discovering");

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      const seenFingerprints = new Set();
      let queuedCount = 0;

      const resolveTrackMetadata = async (entry, fingerprint) => {
        if (!canBrowserPlay(entry.file.type)) {
          return { scanStatus: "unsupported", title: titleFromFilename(entry.file.name), artist: "Unknown Artist", album: null };
        }

        const cached = await getCachedTrackMetadata(fingerprint);
        if (cached) {
          return {
            title: cached.title,
            artist: cached.artist,
            album: cached.album,
            trackNumber: cached.trackNumber ?? null,
            releaseYear: cached.releaseYear ?? null,
            genres: cached.genres || [],
            durationSeconds: cached.durationSeconds ?? null,
            format: cached.container || cached.codec || null,
            bitrate: cached.bitrate ?? null,
            scanStatus: "ready",
          };
        }

        let meta;
        try {
          meta = await extractTrackMetadata(entry.file, entry.relativePath);
        } catch {
          return { scanStatus: "metadata_error", title: titleFromFilename(entry.file.name), artist: "Unknown Artist", album: null };
        }

        await putCachedTrackMetadata(fingerprint, {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          trackNumber: meta.trackNumber,
          releaseYear: meta.releaseYear,
          genres: meta.genres,
          durationSeconds: meta.durationSeconds,
          codec: meta.codec,
          container: meta.container,
          bitrate: meta.bitrate,
          hasArtwork: !!meta.artworkBlob,
        });

        return {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          trackNumber: meta.trackNumber ?? null,
          releaseYear: meta.releaseYear ?? null,
          genres: meta.genres,
          durationSeconds: meta.durationSeconds,
          format: meta.container || meta.codec || null,
          bitrate: meta.bitrate,
          artworkBlob: meta.artworkBlob,
          scanStatus: meta.metadataError ? "metadata_error" : "ready",
        };
      };

      const jobQueue = createJobQueue({
        limit: METADATA_CONCURRENCY,
        signal,
        onSettled: (err, result, meta) => {
          bumpCounter("processed");
          if (err) {
            updateTrack(meta.id, { scanStatus: "metadata_error", artist: "Unknown Artist" });
            bumpCounter("metadataErrors");
            return;
          }
          const { artworkBlob, ...patch } = result;
          if (artworkBlob) artworkBlobsRef.current.set(meta.id, artworkBlob);
          updateTrack(meta.id, patch);
          if (patch.scanStatus === "ready") bumpCounter("readyToPlay");
          else if (patch.scanStatus === "unsupported") bumpCounter("unsupported");
          else if (patch.scanStatus === "metadata_error") bumpCounter("metadataErrors");
        },
      });
      jobQueueRef.current = jobQueue;

      const entryIterable =
        kind === "directory" ? iterateDirectoryFiles(source, { signal }) : iterateFileListEntries(source, { signal });

      let discoveryFailed = false;
      try {
        for await (const entry of entryIterable) {
          if (signal.aborted) break;
          bumpCounter("discoveredFiles");

          if (!looksLikeAudioFile(entry.file)) continue;
          bumpCounter("audioCandidates");
          bumpCounter("totalSizeBytes", entry.file.size);

          const fingerprint = await buildFastFingerprint({
            relativePath: entry.relativePath,
            filename: entry.file.name,
            sizeBytes: entry.file.size,
            lastModified: entry.file.lastModified,
          });
          const id = `device:${fingerprint}`;
          const isDuplicate = seenFingerprints.has(fingerprint);
          seenFingerprints.add(fingerprint);

          const placeholder = {
            id,
            sourceType: "device",
            file: entry.file,
            fileHandle: entry.fileHandle,
            relativePath: entry.relativePath,
            filename: entry.file.name,
            sizeBytes: entry.file.size,
            lastModified: entry.file.lastModified,
            title: titleFromFilename(entry.file.name) || entry.file.name,
            artist: isDuplicate ? "Unknown Artist" : "Reading metadata…",
            album: null,
            durationSeconds: null,
            mimeType: entry.file.type || null,
            format: null,
            importStatus: "not_imported",
            scanStatus: isDuplicate ? "duplicate" : "reading_metadata",
          };
          setTracks((prev) => [...prev, placeholder]);

          if (isDuplicate) {
            bumpCounter("duplicates");
            continue;
          }

          queuedCount += 1;
          bumpCounter("queuedForMetadata");
          jobQueue.push(() => resolveTrackMetadata(entry, fingerprint), { id });
        }
      } catch (err) {
        if (!(err instanceof ScanCancelledError) && !signal.aborted) {
          discoveryFailed = true;
          setScanPhase("error");
          setScanError(err?.message || "Could not read the selected folder.");
        }
      }

      jobQueue.close();

      if (discoveryFailed) return;

      if (signal.aborted) {
        setScanPhase("cancelled");
        return;
      }

      if (queuedCount > 0) setScanPhase("reading_metadata");
      await jobQueue.waitIdle();

      setScanPhase(signal.aborted ? "cancelled" : "ready");
    },
    [bumpCounter, revokeAllArtworkUrls, revokeAllPlaybackUrls, updateTrack]
  );

  const scanFromDirectoryPicker = useCallback(async () => {
    setScanError(null);
    setScanPhase("requesting_permission");
    let handle;
    try {
      handle = await pickDirectory();
    } catch (err) {
      setScanPhase("error");
      setScanError(err?.message || "Could not open the folder picker.");
      return;
    }
    if (!handle) {
      setScanPhase((prev) => (prev === "requesting_permission" ? "idle" : prev));
      return; // user cancelled the picker — not an error
    }

    directoryHandleRef.current = handle;
    setPermissionState("granted");
    await saveDirectoryHandle(handle, { name: handle.name });

    await runDiscoveryPipeline({ kind: "directory", source: handle, sourceLabel: handle.name });
  }, [runDiscoveryPipeline]);

  const scanFromFileList = useCallback(
    async (fileList, { label = "Selected files" } = {}) => {
      setScanError(null);
      if (!fileList?.length) return;
      await runDiscoveryPipeline({ kind: "filelist", source: fileList, sourceLabel: label });
    },
    [runDiscoveryPipeline]
  );

  const cancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
    jobQueueRef.current?.close();
  }, []);

  const rescan = useCallback(async () => {
    const handle = directoryHandleRef.current;
    if (!handle) return;
    const permission = await queryDirectoryPermission(handle);
    if (permission !== "granted") {
      setPermissionState(permission);
      return;
    }
    await runDiscoveryPipeline({ kind: "directory", source: handle, sourceLabel: handle.name });
  }, [runDiscoveryPipeline]);

  // Restores a previously-granted directory handle from IndexedDB on demand
  // (called explicitly from a user action — e.g. visiting the page — never
  // assumed to silently still be valid).
  const restoreSavedDirectory = useCallback(async () => {
    const record = await getSavedDirectoryHandle();
    if (!record?.handle) {
      setPermissionState(null);
      return;
    }
    directoryHandleRef.current = record.handle;
    setDirectoryName(record.name);
    const permission = await queryDirectoryPermission(record.handle);
    setPermissionState(permission);
  }, []);

  // Only ever called from a user-initiated action (a button click).
  const grantSavedDirectoryPermission = useCallback(async () => {
    const handle = directoryHandleRef.current;
    if (!handle) return;
    const result = await requestDirectoryPermission(handle);
    setPermissionState(result);
    if (result === "granted") await rescan();
  }, [rescan]);

  const clearLibrary = useCallback(async () => {
    abortControllerRef.current?.abort();
    jobQueueRef.current?.close();
    revokeAllArtworkUrls();
    revokeAllPlaybackUrls();
    setTracks([]);
    setSelectedIds(new Set());
    setScanPhase("idle");
    setScanError(null);
    setCounters(EMPTY_COUNTERS);
    setDirectoryName(null);
    setPermissionState(null);
    directoryHandleRef.current = null;
    await clearSavedDirectoryHandle();
  }, [revokeAllArtworkUrls, revokeAllPlaybackUrls]);

  // --- Selection -----------------------------------------------------------

  const toggleTrackSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllPlayable = useCallback(() => {
    setTracks((prev) => {
      setSelectedIds(new Set(prev.filter((t) => t.scanStatus === "ready").map((t) => t.id)));
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // --- Import ----------------------------------------------------------------

  const importTracks = useCallback(
    async (trackIds) => {
      importCancelledRef.current = false;
      const idsToImport = trackIds.filter((id) => {
        const track = tracks.find((t) => t.id === id);
        return track && (track.scanStatus === "ready" || track.scanStatus === "metadata_error") && track.importStatus !== "success";
      });

      idsToImport.forEach((id) => updateTrack(id, { importStatus: "pending", importProgress: 0 }));
      setImportSummary((prev) => ({ ...prev, inFlight: idsToImport.length }));

      const uploadOne = async (id) => {
        if (importCancelledRef.current) {
          updateTrack(id, { importStatus: "not_imported", importProgress: 0 });
          return;
        }
        const track = tracks.find((t) => t.id === id);
        if (!track) return;

        updateTrack(id, { importStatus: "uploading", importProgress: 0 });

        const formData = new FormData();
        formData.append("audio", track.file, track.filename);
        if (track.title) formData.append("title", track.title);
        if (track.artist && track.artist !== "Unknown Artist") formData.append("artistName", track.artist);
        if (track.album && track.album !== "Unknown Album") formData.append("albumTitle", track.album);
        if (track.trackNumber) formData.append("trackNumber", String(track.trackNumber));
        if (track.releaseYear) formData.append("releaseYear", String(track.releaseYear));

        try {
          const res = await songApi.importSong(formData, {
            onUploadProgress: (evt) => {
              if (evt.total) updateTrack(id, { importProgress: Math.round((evt.loaded / evt.total) * 100) });
            },
          });
          updateTrack(id, {
            importStatus: res.data.duplicate ? "duplicate" : "success",
            importProgress: 100,
            importedSongId: res.data.song.id,
            importError: null,
          });
        } catch (err) {
          updateTrack(id, { importStatus: "failed", importError: extractErrorMessage(err) });
        }
      };

      const importQueue = createJobQueue({ limit: IMPORT_CONCURRENCY });
      await Promise.all(idsToImport.map((id) => new Promise((resolve) => {
        importQueue.push(async () => {
          await uploadOne(id);
          resolve();
        });
      })));
      importQueue.close();

      setImportSummary((prev) => ({ ...prev, inFlight: 0 }));
    },
    [tracks, updateTrack]
  );

  const retryImport = useCallback((id) => importTracks([id]), [importTracks]);

  const cancelPendingImports = useCallback(() => {
    importCancelledRef.current = true;
  }, []);

  // --- Derived summary -------------------------------------------------------

  const summary = useMemo(
    () => ({
      inspected: counters.audioCandidates,
      playable: counters.readyToPlay,
      unsupported: counters.unsupported,
      duplicates: counters.duplicates,
      metadataErrors: counters.metadataErrors,
      totalSizeBytes: counters.totalSizeBytes,
    }),
    [counters]
  );

  const value = useMemo(
    () => ({
      isDirectoryPickerSupported: isDirectoryPickerSupported(),
      scanPhase,
      counters,
      scanError,
      tracks,
      summary,
      directoryName,
      permissionState,
      selectedIds,
      importSummary,
      scanFromDirectoryPicker,
      scanFromFileList,
      cancelScan,
      rescan,
      restoreSavedDirectory,
      grantSavedDirectoryPermission,
      clearLibrary,
      toggleTrackSelection,
      selectAllPlayable,
      clearSelection,
      getPlaybackUrl,
      getArtworkUrl,
      importTracks,
      retryImport,
      cancelPendingImports,
    }),
    [
      scanPhase,
      counters,
      scanError,
      tracks,
      summary,
      directoryName,
      permissionState,
      selectedIds,
      importSummary,
      scanFromDirectoryPicker,
      scanFromFileList,
      cancelScan,
      rescan,
      restoreSavedDirectory,
      grantSavedDirectoryPermission,
      clearLibrary,
      toggleTrackSelection,
      selectAllPlayable,
      clearSelection,
      getPlaybackUrl,
      getArtworkUrl,
      importTracks,
      retryImport,
      cancelPendingImports,
    ]
  );

  return <DeviceLibraryContext.Provider value={value}>{children}</DeviceLibraryContext.Provider>;
}
