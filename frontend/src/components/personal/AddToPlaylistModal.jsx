import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { CheckIcon, PlusIcon, PlaylistIcon } from "../common/icons";
import { CreatePlaylistModal } from "./CreatePlaylistModal";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";
import * as playlistApi from "../../api/playlistApi";
import { extractErrorMessage } from "../../api/axiosInstance";

export function AddToPlaylistModal({ open, onClose, song }) {
  const { playlists, playlistsLoading, refreshPlaylists } = usePersonalLibrary();
  const [membership, setMembership] = useState({}); // playlistId -> boolean
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!open || !song || playlists.length === 0) {
      setMembership({});
      return undefined;
    }

    // The playlist summary list doesn't carry per-song membership, so it's
    // resolved here — bounded by how many playlists the user has, never by
    // catalog size.
    let cancelled = false;
    setError("");
    setMembershipLoading(true);

    Promise.all(playlists.map((playlist) => playlistApi.getPlaylist(playlist.id)))
      .then((responses) => {
        if (cancelled) return;
        const next = {};
        responses.forEach((res, i) => {
          const playlistId = playlists[i].id;
          next[playlistId] = res.data.playlist.songs.some((s) => String(s.id) === String(song.id));
        });
        setMembership(next);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setMembershipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, song, playlists]);

  if (!song) return null;

  const handleToggle = async (playlist) => {
    if (pendingId || membershipLoading) return;
    setPendingId(playlist.id);
    setError("");
    try {
      const isMember = membership[playlist.id];
      if (isMember) {
        await playlistApi.removeSongFromPlaylist(playlist.id, song.id);
        setMembership((prev) => ({ ...prev, [playlist.id]: false }));
      } else {
        await playlistApi.addSongToPlaylist(playlist.id, song.id);
        setMembership((prev) => ({ ...prev, [playlist.id]: true }));
      }
      await refreshPlaylists();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <Modal open={open && !createOpen} onClose={onClose} title={`Add "${song.title}" to playlist`}>
        <div className="space-y-4">
          {playlistsLoading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner label="Loading playlists" />
            </div>
          ) : playlists.length === 0 ? (
            <p className="text-sm text-rockstar-text-secondary">You don't have any playlists yet.</p>
          ) : (
            <ul className="scrollbar-rockstar max-h-64 space-y-1 overflow-y-auto">
              {playlists.map((playlist) => {
                const isMember = Boolean(membership[playlist.id]);
                return (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      onClick={() => handleToggle(playlist)}
                      disabled={pendingId === playlist.id || membershipLoading}
                      aria-pressed={isMember}
                      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-field)] px-3 py-2.5 text-left text-sm text-rockstar-text-primary hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-60"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {playlist.name}
                        <span className="ml-2 text-xs text-rockstar-text-secondary">
                          {playlist.songCount === 1 ? "1 song" : `${playlist.songCount} songs`}
                        </span>
                      </span>
                      {pendingId === playlist.id || membershipLoading ? (
                        <LoadingSpinner size="sm" label="Updating" />
                      ) : isMember ? (
                        <CheckIcon width={18} height={18} className="text-rockstar-tan" aria-hidden="true" />
                      ) : (
                        <PlusIcon width={18} height={18} className="text-rockstar-text-secondary" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div role="alert" aria-live="polite">
            {error && <p className="text-xs text-rockstar-error">{error}</p>}
          </div>

          <Button variant="secondary" size="sm" fullWidth onClick={() => setCreateOpen(true)}>
            <PlaylistIcon width={16} height={16} aria-hidden="true" />
            New playlist
          </Button>
        </div>
      </Modal>

      <CreatePlaylistModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(playlist) => setMembership((prev) => ({ ...prev, [playlist.id]: false }))}
      />
    </>
  );
}
