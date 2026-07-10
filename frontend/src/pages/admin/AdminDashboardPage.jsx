import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { AdminMetricCard } from "../../components/admin/AdminMetricCard";
import * as adminApi from "../../api/adminApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { formatDuration } from "../../utils/duration";

const formatListenedTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
};

export default function AdminDashboardPage() {
  const [state, setState] = useState({ key: null, overview: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const isLoading = state.key !== refreshIndex;

  useEffect(() => {
    let cancelled = false;

    adminApi
      .getDashboard()
      .then((res) => {
        if (cancelled) return;
        setState({ key: refreshIndex, overview: res.data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ key: refreshIndex, overview: null, error: extractErrorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Overview" description="Real platform metrics - no fabricated growth or charts." />

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading dashboard" size="lg" />
        </div>
      )}

      {!isLoading && state.error && (
        <ErrorState message={state.error} onRetry={() => setRefreshIndex((i) => i + 1)} />
      )}

      {!isLoading && !state.error && state.overview && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-rockstar-text-secondary">Users</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AdminMetricCard label="Total users" value={state.overview.users.total} />
              <AdminMetricCard label="Active" value={state.overview.users.active} />
              <AdminMetricCard label="Suspended" value={state.overview.users.suspended} />
              <AdminMetricCard label="Administrators" value={state.overview.users.administrators} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-rockstar-text-secondary">Catalog</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AdminMetricCard
                label="Songs"
                value={state.overview.songs.total}
                hint={`${state.overview.songs.published} published · ${state.overview.songs.draft} draft`}
              />
              <AdminMetricCard label="Artists" value={state.overview.catalog.artists} />
              <AdminMetricCard label="Albums" value={state.overview.catalog.albums} />
              <AdminMetricCard label="Genres" value={state.overview.catalog.genres} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-rockstar-text-secondary">Listening</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AdminMetricCard label="Qualified plays" value={state.overview.listening.qualifiedPlays} />
              <AdminMetricCard
                label="Total listening time"
                value={formatListenedTime(state.overview.listening.totalListenedSeconds)}
              />
              <AdminMetricCard label="Playlists" value={state.overview.catalog.playlists} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-rockstar-text-primary">Recent registrations</h2>
                <Link to="/admin/users" className="text-xs text-rockstar-tan hover:underline">
                  Manage users
                </Link>
              </div>
              {state.overview.recentRegistrations.length === 0 ? (
                <p className="text-sm text-rockstar-text-secondary">No registrations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {state.overview.recentRegistrations.map((registration) => (
                    <li key={registration.id} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate text-rockstar-text-primary">{registration.fullName}</span>
                      <span className="shrink-0 text-xs text-rockstar-text-secondary">
                        {new Date(registration.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-rockstar-text-primary">Recent uploads</h2>
                <Link to="/admin/music" className="text-xs text-rockstar-tan hover:underline">
                  Manage music
                </Link>
              </div>
              {state.overview.recentUploads.length === 0 ? (
                <p className="text-sm text-rockstar-text-secondary">No uploads yet.</p>
              ) : (
                <ul className="space-y-2">
                  {state.overview.recentUploads.map((upload) => (
                    <li key={upload.id} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate text-rockstar-text-primary">{upload.title}</span>
                      <span className="shrink-0 text-xs text-rockstar-text-secondary">
                        {upload.isPublished ? "Published" : "Draft"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="space-y-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
            <h2 className="text-sm font-semibold text-rockstar-text-primary">Most-played songs</h2>
            {state.overview.mostPlayedSongs.length === 0 ? (
              <p className="text-sm text-rockstar-text-secondary">No qualified plays yet.</p>
            ) : (
              <ul className="space-y-2">
                {state.overview.mostPlayedSongs.map((song) => (
                  <li key={song.id} className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate text-rockstar-text-primary">
                      {song.title} <span className="text-rockstar-text-secondary">- {song.artist?.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-rockstar-text-secondary">
                      {song.playCount} plays · {formatDuration(song.durationSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
