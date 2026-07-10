import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { SongRow } from "../../components/music/SongRow";
import { ClockIcon } from "../../components/common/icons";
import * as historyApi from "../../api/historyApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { usePlayer } from "../../hooks/usePlayer";
import { formatDuration } from "../../utils/duration";

const formatListenedTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
};

export default function HistoryPage() {
  const { playQueue } = usePlayer();
  const [state, setState] = useState({ key: null, items: [], stats: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const isLoading = state.key !== refreshIndex;

  useEffect(() => {
    let cancelled = false;

    Promise.all([historyApi.getRecentHistory({ limit: 30 }), historyApi.getHistoryStats()])
      .then(([recentRes, statsRes]) => {
        if (cancelled) return;
        setState({ key: refreshIndex, items: recentRes.data.items, stats: statsRes.data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ key: refreshIndex, items: [], stats: null, error: extractErrorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const handleClear = async () => {
    await historyApi.clearHistory();
    setClearOpen(false);
    setRefreshIndex((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listening History"
        description="Songs you've actually listened to, not just clicked."
        actions={
          state.items.length > 0 && (
            <Button variant="ghost" size="sm" className="text-rockstar-error hover:bg-rockstar-error/10" onClick={() => setClearOpen(true)}>
              Clear history
            </Button>
          )
        }
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading history" size="lg" />
        </div>
      )}

      {!isLoading && state.error && <ErrorState message={state.error} onRetry={() => setRefreshIndex((i) => i + 1)} />}

      {!isLoading && !state.error && state.stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Qualified plays" value={state.stats.totalQualifiedPlays} />
          <StatCard label="Listening time" value={formatListenedTime(state.stats.totalListenedSeconds)} />
          <StatCard label="Unique songs" value={state.stats.uniqueSongsPlayed} />
          <StatCard label="Top artist" value={state.stats.topArtist?.name || "-"} />
        </div>
      )}

      {!isLoading && !state.error && state.items.length === 0 && (
        <EmptyState
          icon={ClockIcon}
          title="No listening history yet"
          description="Songs you listen to for a meaningful amount of time will show up here."
        />
      )}

      {!isLoading && !state.error && state.items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-rockstar-text-secondary">Recently played</h2>
          <div className="space-y-1">
            {state.items.map((song, index) => (
              <SongRow key={song.id} song={song} onPlay={() => playQueue(state.items, index)} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !state.error && state.stats?.mostPlayedSongs?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-rockstar-text-secondary">Most played</h2>
          <div className="space-y-1">
            {state.stats.mostPlayedSongs.map((song) => (
              <div key={song.id} className="flex items-center justify-between px-3 text-sm text-rockstar-text-secondary">
                <span className="truncate text-rockstar-text-primary">{song.title}</span>
                <span className="shrink-0">
                  {song.userPlayCount} {song.userPlayCount === 1 ? "play" : "plays"} · {formatDuration(song.durationSeconds)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear listening history?"
        description="This removes your recent-plays and statistics history. It does not affect the catalog's public play counts or delete any audio."
        confirmLabel="Clear history"
        onConfirm={handleClear}
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-4">
      <p className="text-xs text-rockstar-text-secondary">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-rockstar-text-primary">{value}</p>
    </div>
  );
}
