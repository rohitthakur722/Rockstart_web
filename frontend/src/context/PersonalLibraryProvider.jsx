import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as likeApi from "../api/likeApi";
import * as playlistApi from "../api/playlistApi";
import { extractErrorMessage } from "../api/axiosInstance";
import { PersonalLibraryContext } from "./PersonalLibraryContext";

// Shared, user-scoped liked-song-ID Set and playlist summaries — so every
// heart button and playlist picker across the app reads one source of truth
// instead of each SongRow fetching its own like status.
export function PersonalLibraryProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  const [likedSongIds, setLikedSongIds] = useState(() => new Set());
  const [playlists, setPlaylists] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [error, setError] = useState("");

  const pendingLikeRequests = useRef(new Map());

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setLikedSongIds(new Set());
      setPlaylists([]);
      setError("");
      setLikesLoading(false);
      setPlaylistsLoading(false);
      pendingLikeRequests.current.clear();
      return undefined;
    }

    const controller = new AbortController();
    setLikesLoading(true);
    setPlaylistsLoading(true);
    setError("");

    likeApi
      .listLikedIds({ signal: controller.signal })
      .then((res) => setLikedSongIds(new Set(res.data.songIds)))
      .catch((err) => {
        if (!controller.signal.aborted) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLikesLoading(false);
      });

    playlistApi
      .listPlaylists({ signal: controller.signal })
      .then((res) => setPlaylists(res.data.playlists))
      .catch((err) => {
        if (!controller.signal.aborted) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlaylistsLoading(false);
      });

    return () => controller.abort();
  }, [isAuthenticated, userId]);

  const isLiked = useCallback((songId) => likedSongIds.has(String(songId)), [likedSongIds]);

  // Optimistic toggle with rollback; concurrent callers for the same song
  // (e.g. the same track's heart button visible in both a SongRow and the
  // PlayerBar) share one in-flight request instead of firing twice.
  const toggleLike = useCallback(
    (song) => {
      const songId = String(song.id);
      const existing = pendingLikeRequests.current.get(songId);
      if (existing) return existing;

      const wasLiked = likedSongIds.has(songId);
      setLikedSongIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(songId);
        else next.add(songId);
        return next;
      });

      const apiCall = wasLiked ? likeApi.unlikeSong(songId) : likeApi.likeSong(songId);
      const request = apiCall
        .catch((err) => {
          setLikedSongIds((prev) => {
            const next = new Set(prev);
            if (wasLiked) next.add(songId);
            else next.delete(songId);
            return next;
          });
          throw err;
        })
        .finally(() => {
          pendingLikeRequests.current.delete(songId);
        });

      pendingLikeRequests.current.set(songId, request);
      return request;
    },
    [likedSongIds]
  );

  const refreshPlaylists = useCallback(async () => {
    if (!isAuthenticated) return;
    setPlaylistsLoading(true);
    try {
      const res = await playlistApi.listPlaylists();
      setPlaylists(res.data.playlists);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPlaylistsLoading(false);
    }
  }, [isAuthenticated]);

  const createPlaylist = useCallback(
    async (payload) => {
      const res = await playlistApi.createPlaylist(payload);
      await refreshPlaylists();
      return res.data.playlist;
    },
    [refreshPlaylists]
  );

  const value = useMemo(
    () => ({
      likedSongIds,
      isLiked,
      toggleLike,
      likesLoading,
      playlists,
      playlistsLoading,
      refreshPlaylists,
      createPlaylist,
      error,
    }),
    [likedSongIds, isLiked, toggleLike, likesLoading, playlists, playlistsLoading, refreshPlaylists, createPlaylist, error]
  );

  return <PersonalLibraryContext.Provider value={value}>{children}</PersonalLibraryContext.Provider>;
}
