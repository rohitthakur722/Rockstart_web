import { useCallback, useMemo, useRef, useState } from "react";
import {
  isDirectoryPickerSupported,
  pickDirectory,
  queryDirectoryPermission,
  requestDirectoryPermission,
  iterateDirectoryFiles,
  filesFromFileList,
  looksLikeAudioFile,
  canBrowserPlay,
  buildFastFingerprint,
  computeContentHash,
  extractTrackMetadata,
  runWithConcurrency,
  ScanCancelledError,
} from "../services/deviceMusicScanner";
import { saveDirectoryHandle, getSavedDirectoryHandle, clearSavedDirectoryHandle } from "../utils/deviceLibraryDb";
import * as songApi from "../api/songApi";
import { extractErrorMessage } from "../api/axiosInstance";
import { DeviceLibraryContext } from "./DeviceLibraryContext";

const METADATA_CONCURRENCY = 4;
const IMPORT_CONCURRENCY = 2;

let deviceIdCounter = 0;
const nextLocalKey = () => {
  deviceIdCounter += 1;
  return deviceIdCounter;
};

export function DeviceLibraryProvider({ children }) {
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done | cancelled | error
  const [scanProgress, setScanProgress] = useState({ processed: 0, total: 0 });
  const [scanError, setScanError] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [directoryName, setDirectoryName] = useState(null);
  const [permissionState, setPermissionState] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [importSummary, setImportSummary] = useState({ inFlight: 0 });

  const directoryHandleRef = useRef(null);
  const abortControllerRef = useRef(null);
  const playbackUrlsRef = useRef(new Map());
  const artworkUrlsRef = useRef(new Map());
  const importCancelledRef = useRef(false);

  const revokeAllObjectUrls = useCallback(() => {
    for (const url of playbackUrlsRef.current.values()) URL.revokeObjectURL(url);
    for (const url of artworkUrlsRef.current.values()) URL.revokeObjectURL(url);
    playbackUrlsRef.current.clear();
    artworkUrlsRef.current.clear();
  }, []);

  const getPlaybackUrl = useCallback((track) => {
    if (!track?.file) return null;
    const existing = playbackUrlsRef.current.get(track.id);
    if (existing) return existing;
    const url = URL.createObjectURL(track.file);
    playbackUrlsRef.current.set(track.id, url);
    return url;
  }, []);

  const updateTrack = useCallback((id, patch) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  // --- Scanning --------------------------------------------------------------

  const runScan = useCallback(async (rawEntries, { sourceLabel } = {}) => {
    revokeAllObjectUrls();
    setTracks([]);
    setSelectedIds(new Set());
    setScanError(null);
    setScanState("scanning");
    setScanProgress({ processed: 0, total: rawEntries.length });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seenFingerprints = new Set();
    const seenContentHashes = new Set();

    const builtTracks = rawEntries.map((entry) => ({
      localKey: nextLocalKey(),
      file: entry.file,
      fileHandle: entry.fileHandle,
      relativePath: entry.relativePath,
      filename: entry.file.name,
      sizeBytes: entry.file.size,
      lastModified: entry.file.lastModified,
    }));

    try {
      await runWithConcurrency(
        builtTracks,
        async (entry) => {
          if (controller.signal.aborted) throw new ScanCancelledError();

          const fingerprint = await buildFastFingerprint({
            relativePath: entry.relativePath,
            filename: entry.filename,
            sizeBytes: entry.sizeBytes,
            lastModified: entry.lastModified,
          });
          const id = `device:${fingerprint}`;

          const isFastDuplicate = seenFingerprints.has(fingerprint);
          seenFingerprints.add(fingerprint);

          const looksAudio = looksLikeAudioFile(entry.file);
          if (!looksAudio) {
            return {
              id,
              sourceType: "device",
              file: entry.file,
              fileHandle: entry.fileHandle,
              relativePath: entry.relativePath,
              filename: entry.filename,
              sizeBytes: entry.sizeBytes,
              lastModified: entry.lastModified,
              title: entry.filename,
              artist: null,
              album: null,
              genres: [],
              durationSeconds: null,
              mimeType: entry.file.type || null,
              format: null,
              artworkUrl: null,
              importStatus: "not_imported",
              scanStatus: "unsupported",
            };
          }

          const playable = canBrowserPlay(entry.file.type);

          let contentHash = null;
          let isContentDuplicate = false;
          if (entry.sizeBytes > 0 && entry.sizeBytes < 100 * 1024 * 1024) {
            try {
              contentHash = await computeContentHash(entry.file);
              isContentDuplicate = seenContentHashes.has(contentHash);
              seenContentHashes.add(contentHash);
            } catch {
              // Hashing failure never blocks playback — duplicate detection
              // just falls back to the fast fingerprint alone.
            }
          }

          const isDuplicate = isFastDuplicate || isContentDuplicate;

          let meta = {
            title: entry.filename,
            artist: "Unknown Artist",
            album: "Unknown Album",
            genres: [],
            durationSeconds: null,
            codec: null,
            container: null,
            bitrate: null,
            artworkBlob: null,
            metadataError: false,
          };
          if (!isDuplicate) {
            try {
              meta = await extractTrackMetadata(entry.file, entry.relativePath);
            } catch {
              meta = { ...meta, metadataError: true };
            }
          }

          let artworkUrl = null;
          if (meta.artworkBlob) {
            artworkUrl = URL.createObjectURL(meta.artworkBlob);
            artworkUrlsRef.current.set(id, artworkUrl);
          }

          let scanStatus;
          if (isDuplicate) scanStatus = "duplicate";
          else if (!playable) scanStatus = "unsupported";
          else if (meta.metadataError) scanStatus = "metadata_error";
          else scanStatus = "playable";

          return {
            id,
            sourceType: "device",
            file: entry.file,
            fileHandle: entry.fileHandle,
            relativePath: entry.relativePath,
            filename: entry.filename,
            sizeBytes: entry.sizeBytes,
            lastModified: entry.lastModified,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            trackNumber: meta.trackNumber ?? null,
            releaseYear: meta.releaseYear ?? null,
            genres: meta.genres,
            durationSeconds: meta.durationSeconds,
            mimeType: entry.file.type || null,
            format: meta.container || meta.codec || null,
            contentHash,
            artworkUrl,
            importStatus: "not_imported",
            scanStatus,
          };
        },
        {
          limit: METADATA_CONCURRENCY,
          signal: controller.signal,
          onItemDone: (result) => {
            setScanProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
            if (result && !result.error) {
              setTracks((prev) => [...prev, result]);
            }
          },
        }
      );

      if (controller.signal.aborted) {
        setScanState("cancelled");
        return;
      }
      setScanState("done");
      if (sourceLabel) setDirectoryName(sourceLabel);
    } catch (err) {
      if (err instanceof ScanCancelledError || controller.signal.aborted) {
        setScanState("cancelled");
        return;
      }
      setScanState("error");
      setScanError(err?.message || "Scanning failed.");
    }
  }, [revokeAllObjectUrls]);

  const scanFromDirectoryPicker = useCallback(async () => {
    setScanError(null);
    let handle;
    try {
      handle = await pickDirectory();
    } catch (err) {
      setScanState("error");
      setScanError(err?.message || "Could not open the folder picker.");
      return;
    }
    if (!handle) return; // user cancelled — not an error

    directoryHandleRef.current = handle;
    setPermissionState("granted");
    await saveDirectoryHandle(handle, { name: handle.name });

    const controller = new AbortController();
    const entries = [];
    try {
      for await (const entry of iterateDirectoryFiles(handle, { signal: controller.signal })) {
        entries.push(entry);
      }
    } catch {
      setScanState("error");
      setScanError("Could not read the selected folder.");
      return;
    }

    if (entries.length === 0) {
      setScanState("done");
      setTracks([]);
      setDirectoryName(handle.name);
      return;
    }

    await runScan(entries, { sourceLabel: handle.name });
  }, [runScan]);

  const scanFromFileList = useCallback(
    async (fileList, { label = "Selected files" } = {}) => {
      setScanError(null);
      const entries = filesFromFileList(fileList);
      if (entries.length === 0) return;
      await runScan(entries, { sourceLabel: label });
    },
    [runScan]
  );

  const cancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const rescan = useCallback(async () => {
    const handle = directoryHandleRef.current;
    if (!handle) return;
    const permission = await queryDirectoryPermission(handle);
    if (permission !== "granted") {
      setPermissionState(permission);
      return;
    }
    const controller = new AbortController();
    const entries = [];
    try {
      for await (const entry of iterateDirectoryFiles(handle, { signal: controller.signal })) {
        entries.push(entry);
      }
    } catch {
      setScanState("error");
      setScanError("Could not read the selected folder.");
      return;
    }
    await runScan(entries, { sourceLabel: handle.name });
  }, [runScan]);

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
    revokeAllObjectUrls();
    setTracks([]);
    setSelectedIds(new Set());
    setScanState("idle");
    setScanError(null);
    setScanProgress({ processed: 0, total: 0 });
    setDirectoryName(null);
    setPermissionState(null);
    directoryHandleRef.current = null;
    await clearSavedDirectoryHandle();
  }, [revokeAllObjectUrls]);

  // --- Selection ---------------------------------------------------------

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
      setSelectedIds(new Set(prev.filter((t) => t.scanStatus === "playable").map((t) => t.id)));
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // --- Import --------------------------------------------------------------

  const importTracks = useCallback(
    async (trackIds) => {
      importCancelledRef.current = false;
      const idsToImport = trackIds.filter((id) => {
        const track = tracks.find((t) => t.id === id);
        return track && track.scanStatus === "playable" && track.importStatus !== "success";
      });

      idsToImport.forEach((id) => updateTrack(id, { importStatus: "pending", importProgress: 0 }));
      setImportSummary((prev) => ({ ...prev, inFlight: idsToImport.length }));

      await runWithConcurrency(
        idsToImport,
        async (id) => {
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
        },
        { limit: IMPORT_CONCURRENCY }
      );

      setImportSummary((prev) => ({ ...prev, inFlight: 0 }));
    },
    [tracks, updateTrack]
  );

  const retryImport = useCallback((id) => importTracks([id]), [importTracks]);

  const cancelPendingImports = useCallback(() => {
    importCancelledRef.current = true;
  }, []);

  // --- Derived summary -----------------------------------------------------

  const summary = useMemo(() => {
    const totalSizeBytes = tracks.reduce((sum, t) => sum + (t.sizeBytes || 0), 0);
    return {
      inspected: tracks.length,
      playable: tracks.filter((t) => t.scanStatus === "playable").length,
      unsupported: tracks.filter((t) => t.scanStatus === "unsupported").length,
      duplicates: tracks.filter((t) => t.scanStatus === "duplicate").length,
      metadataErrors: tracks.filter((t) => t.scanStatus === "metadata_error").length,
      totalSizeBytes,
    };
  }, [tracks]);

  const value = useMemo(
    () => ({
      isDirectoryPickerSupported: isDirectoryPickerSupported(),
      scanState,
      scanProgress,
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
      importTracks,
      retryImport,
      cancelPendingImports,
    }),
    [
      scanState,
      scanProgress,
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
      importTracks,
      retryImport,
      cancelPendingImports,
    ]
  );

  return <DeviceLibraryContext.Provider value={value}>{children}</DeviceLibraryContext.Provider>;
}
