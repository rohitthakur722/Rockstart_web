import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { DeviceTrackRow } from "../../components/library/DeviceTrackRow";
import { ImportConfirmDialog } from "../../components/library/ImportConfirmDialog";
import { FolderIcon, DeviceIcon, TrashIcon, RefreshIcon, PlayIcon, ShuffleIcon, SearchIcon } from "../../components/common/icons";
import { useDeviceLibrary } from "../../hooks/useDeviceLibrary";
import { usePlayer } from "../../hooks/usePlayer";
import { shuffleArray } from "../../utils/queue";
import { formatFileSize } from "../../utils/fileSize";
import { cn } from "../../utils/cn";

const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.m4a,.mp4,.ogg,.opus,.flac,.aac,.webm";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "playable", label: "Playable" },
  { value: "unsupported", label: "Unsupported" },
  { value: "duplicate", label: "Duplicates" },
];

const SORT_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "duration", label: "Duration" },
  { value: "size", label: "File size" },
];

export default function DeviceLibraryPage() {
  const device = useDeviceLibrary();
  const { playQueue } = usePlayer();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("title");
  const [dragActive, setDragActive] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const folderInputRef = useRef(null);
  const filesInputRef = useRef(null);

  useEffect(() => {
    device.restoreSavedDirectory();
    // Runs once, on entering the page — restoring a remembered directory
    // handle is a read-only permission *query*, never an automatic scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTracks = useMemo(() => {
    let list = device.tracks;

    if (statusFilter !== "all") {
      list = list.filter((t) => t.scanStatus === statusFilter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((t) =>
        [t.title, t.artist, t.album, t.filename].some((field) => field?.toLowerCase().includes(term))
      );
    }

    const sorted = list.slice();
    switch (sort) {
      case "artist":
        sorted.sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
        break;
      case "duration":
        sorted.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
        break;
      case "size":
        sorted.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
        break;
      default:
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return sorted;
  }, [device.tracks, statusFilter, search, sort]);

  const playableFiltered = useMemo(() => filteredTracks.filter((t) => t.scanStatus === "playable"), [filteredTracks]);

  const buildPlayableQueue = (startTrack) => {
    const withUrls = playableFiltered.map((t) => ({ ...t, localPlaybackUrl: device.getPlaybackUrl(t) }));
    const startIndex = withUrls.findIndex((t) => t.id === startTrack.id);
    return { withUrls, startIndex: startIndex === -1 ? 0 : startIndex };
  };

  const handlePlayTrack = (track) => {
    const { withUrls, startIndex } = buildPlayableQueue(track);
    playQueue(withUrls, startIndex);
  };

  const handlePlayAll = () => {
    if (playableFiltered.length === 0) return;
    const withUrls = playableFiltered.map((t) => ({ ...t, localPlaybackUrl: device.getPlaybackUrl(t) }));
    playQueue(withUrls, 0);
  };

  const handleShuffleAll = () => {
    if (playableFiltered.length === 0) return;
    const withUrls = playableFiltered.map((t) => ({ ...t, localPlaybackUrl: device.getPlaybackUrl(t) }));
    playQueue(shuffleArray(withUrls), 0);
  };

  const handleFolderInputChange = (event) => {
    if (event.target.files?.length) device.scanFromFileList(event.target.files, { label: "Selected folder" });
    event.target.value = "";
  };

  const handleFilesInputChange = (event) => {
    if (event.target.files?.length) device.scanFromFileList(event.target.files, { label: "Selected files" });
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      device.scanFromFileList(event.dataTransfer.files, { label: "Dropped files" });
    }
  };

  const selectedCount = device.selectedIds.size;
  const selectedSizeBytes = device.tracks
    .filter((t) => device.selectedIds.has(t.id))
    .reduce((sum, t) => sum + (t.sizeBytes || 0), 0);

  const isScanning = device.scanState === "scanning";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Music"
        description="Play music straight from your device - nothing is uploaded unless you choose to import it."
      />

      <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-4">
        <p className="text-sm text-rockstar-text-secondary">
          RockStar can only scan files and folders that you choose. Nothing on your device is accessed until you
          press one of the buttons below.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {device.isDirectoryPickerSupported ? (
            <Button size="sm" onClick={device.scanFromDirectoryPicker} disabled={isScanning}>
              <FolderIcon width={16} height={16} aria-hidden="true" />
              Scan Music Folder
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => folderInputRef.current?.click()} disabled={isScanning}>
                <FolderIcon width={16} height={16} aria-hidden="true" />
                Select Folder
              </Button>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                className="sr-only"
                aria-label="Select a music folder"
                onChange={handleFolderInputChange}
              />
            </>
          )}

          <Button size="sm" variant="secondary" onClick={() => filesInputRef.current?.click()} disabled={isScanning}>
            <DeviceIcon width={16} height={16} aria-hidden="true" />
            Select Audio Files
          </Button>
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept={AUDIO_ACCEPT}
            className="sr-only"
            aria-label="Select audio files"
            onChange={handleFilesInputChange}
          />

          {device.directoryName && !isScanning && (
            <Button size="sm" variant="ghost" onClick={device.rescan}>
              <RefreshIcon width={16} height={16} aria-hidden="true" />
              Rescan
            </Button>
          )}

          {device.tracks.length > 0 && !isScanning && (
            <Button size="sm" variant="ghost" onClick={device.clearLibrary}>
              <TrashIcon width={16} height={16} aria-hidden="true" />
              Clear Device Library
            </Button>
          )}

          {isScanning && (
            <Button size="sm" variant="ghost" onClick={device.cancelScan}>
              Cancel scan
            </Button>
          )}
        </div>

        {!device.isDirectoryPickerSupported && (
          <p className="mt-3 text-xs text-rockstar-text-secondary">
            Your browser doesn't support the folder picker (this is normal in Firefox and Safari) - use "Select
            Folder" or "Select Audio Files" instead. You'll need to re-select the folder after a page refresh.
          </p>
        )}

        {device.permissionState === "prompt" && device.directoryName && (
          <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-field)] border border-rockstar-tan-dark/40 bg-rockstar-tan/5 px-3 py-2">
            <p className="flex-1 text-xs text-rockstar-text-secondary">
              Permission is needed again to rescan "{device.directoryName}".
            </p>
            <Button size="sm" variant="secondary" onClick={device.grantSavedDirectoryPermission}>
              Grant access
            </Button>
          </div>
        )}
        {device.permissionState === "denied" && (
          <p className="mt-3 text-xs text-rockstar-error">
            Access to "{device.directoryName}" was denied. Choose a folder again to continue.
          </p>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-4 rounded-[var(--radius-field)] border border-dashed p-4 text-center text-xs text-rockstar-text-secondary transition-colors",
            dragActive ? "border-rockstar-tan bg-rockstar-tan/5" : "border-rockstar-border"
          )}
        >
          Or drag and drop audio files here
        </div>

        <p className="mt-3 text-xs text-rockstar-text-secondary">
          Only import audio that you own or have permission to use. Scanning never uploads anything automatically -
          device songs stay local until you press Import. Clearing Device Library only removes browser references,
          never the original files on your device.
        </p>
      </div>

      {isScanning && (
        <div role="status" aria-live="polite" className="space-y-2 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-4">
          <div className="flex items-center justify-between text-xs text-rockstar-text-secondary">
            <span>
              Scanning… {device.scanProgress.processed} of {device.scanProgress.total}
            </span>
            <LoadingSpinner size="sm" label="Scanning" />
          </div>
          <progress
            className="h-1.5 w-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-rockstar-surface-elevated [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-rockstar-tan"
            value={device.scanProgress.processed}
            max={Math.max(device.scanProgress.total, 1)}
          />
        </div>
      )}

      {device.scanState === "cancelled" && (
        <p role="status" className="text-sm text-rockstar-text-secondary">
          Scan cancelled. {device.tracks.length > 0 ? "Tracks found so far are shown below." : ""}
        </p>
      )}

      {device.scanState === "error" && <ErrorState title="Scan failed" message={device.scanError} onRetry={device.rescan} />}

      {device.tracks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Inspected", device.summary.inspected],
            ["Playable", device.summary.playable],
            ["Unsupported", device.summary.unsupported],
            ["Duplicates", device.summary.duplicates],
            ["Total size", formatFileSize(device.summary.totalSizeBytes)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface p-3">
              <p className="text-xs text-rockstar-text-secondary">{label}</p>
              <p className="text-lg font-semibold text-rockstar-text-primary">{value}</p>
            </div>
          ))}
        </div>
      )}

      {device.tracks.length === 0 && !isScanning && device.scanState !== "error" && (
        <EmptyState
          icon={DeviceIcon}
          title="No device music scanned yet"
          description="Choose a folder or select files above to browse and play your local music - nothing is uploaded until you explicitly import it."
        />
      )}

      {device.tracks.length > 0 && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handlePlayAll} disabled={playableFiltered.length === 0}>
                <PlayIcon width={14} height={14} aria-hidden="true" />
                Play All
              </Button>
              <Button size="sm" variant="secondary" onClick={handleShuffleAll} disabled={playableFiltered.length === 0}>
                <ShuffleIcon width={14} height={14} aria-hidden="true" />
                Shuffle All
              </Button>
              <Button size="sm" variant="ghost" onClick={device.selectAllPlayable}>
                Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={device.clearSelection} disabled={selectedCount === 0}>
                Clear Selection
              </Button>
            </div>
            <Button size="sm" onClick={() => setImportDialogOpen(true)} disabled={selectedCount === 0}>
              Import Selected {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1 sm:max-w-xs">
              <span className="sr-only">Search device tracks</span>
              <SearchIcon
                aria-hidden="true"
                width={16}
                height={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, artist, album…"
                className="h-9 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort by"
              className="h-9 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            {filteredTracks.length === 0 ? (
              <p className="py-8 text-center text-sm text-rockstar-text-secondary">No tracks match your filters.</p>
            ) : (
              filteredTracks.map((track) => (
                <DeviceTrackRow
                  key={track.id}
                  track={track}
                  selected={device.selectedIds.has(track.id)}
                  onToggleSelect={device.toggleTrackSelection}
                  onRetryImport={device.retryImport}
                  onPlay={handlePlayTrack}
                />
              ))
            )}
          </div>
        </>
      )}

      <ImportConfirmDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onConfirm={() => device.importTracks(Array.from(device.selectedIds))}
        trackCount={selectedCount}
        totalSizeBytes={selectedSizeBytes}
      />
    </div>
  );
}
