import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePreferences } from "../hooks/usePreferences";
import * as playbackApi from "../api/playbackApi";
import { buildMediaUrl } from "../utils/mediaUrl";
import { getAccessToken } from "../services/authTokenStore";
import {
  buildShuffledQueue,
  restoreOriginalQueue,
  getNextIndex,
  getPreviousIndex,
  moveQueueItem as moveQueueItemAt,
  removeQueueItemAt,
} from "../utils/queue";
import { clamp, getBufferedEndSeconds } from "../utils/playbackTime";
import { savePlayerState, loadPlayerState, clearPlayerState } from "../utils/playerStorage";
import { PlayerContext } from "./PlayerContext";

const HEARTBEAT_INTERVAL_MS = 12000;
const UI_UPDATE_MIN_INTERVAL_MS = 250;
const PERSIST_INTERVAL_MS = 5000;
const MAX_ACCUMULATED_DELTA_SECONDS = 2; // ignore timeupdate jumps from seeks/loops

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const friendlyMediaError = (mediaError) => {
  if (!mediaError) return "Rockstar could not play this audio file.";
  switch (mediaError.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Playback was interrupted.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "The audio stream is temporarily unavailable.";
    case MediaError.MEDIA_ERR_DECODE:
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Rockstar could not play this audio file.";
    default:
      return "Rockstar could not play this audio file.";
  }
};

const emptyQueueState = { items: [], originalItems: [], currentIndex: -1 };

export function PlayerProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;
  const scope = isAuthenticated && userId ? String(userId) : null;
  const { preferences } = usePreferences();
  const { autoplayNext, rememberPlayerState } = preferences;

  const audioRef = useRef(null);
  const queueStateRef = useRef(emptyQueueState);
  const repeatModeRef = useRef("off");
  const sessionTokenRef = useRef(null);
  const accumulatedListenedRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const heartbeatTimerRef = useRef(null);
  const persistTimerRef = useRef(null);
  const previousScopeRef = useRef(null);
  const autoplayNextRef = useRef(autoplayNext);

  const [queueState, setQueueStateRaw] = useState(emptyQueueState);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatModeState] = useState("off");
  const [error, setError] = useState(null);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [sessionToken, setSessionTokenState] = useState(null);
  const [loadedScope, setLoadedScope] = useState(null);

  const setQueueState = useCallback((updater) => {
    setQueueStateRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      queueStateRef.current = next;
      return next;
    });
  }, []);

  const setRepeatMode = useCallback((mode) => {
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
  }, []);

  // Kept in a ref so the mount-once `ended` handler always reads the current
  // preference without needing to be re-registered on every change.
  useEffect(() => {
    autoplayNextRef.current = autoplayNext;
  }, [autoplayNext]);

  // Render-time reset the instant the signed-in scope changes (logout, or a
  // different account signing in) — a plain derived-state adjustment rather
  // than an effect, so the UI never shows a stale queue/position from the
  // previous account. Imperative cleanup (audio element, session, storage)
  // happens separately below, in the effect that actually owns those systems.
  if (scope !== loadedScope) {
    setLoadedScope(scope);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setQueueState(emptyQueueState);
  }

  // --- Playback session lifecycle -----------------------------------------

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const setActiveSessionToken = useCallback((token) => {
    sessionTokenRef.current = token;
    setSessionTokenState(token);
  }, []);

  const flushAccumulatedSeconds = useCallback(() => {
    const delta = accumulatedListenedRef.current;
    accumulatedListenedRef.current = 0;
    return delta;
  }, []);

  const startSessionForCurrentSong = useCallback(async () => {
    const song = queueStateRef.current.items[queueStateRef.current.currentIndex];
    if (!song) return;

    try {
      const res = await playbackApi.startSession(song.id);
      setActiveSessionToken(res.data.sessionToken);
      accumulatedListenedRef.current = 0;
      clearHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        const token = sessionTokenRef.current;
        if (!token || !audioRef.current) return;
        const delta = flushAccumulatedSeconds();
        playbackApi
          .sendProgress(token, {
            positionSeconds: audioRef.current.currentTime || 0,
            listenedDeltaSeconds: delta,
            completed: false,
          })
          .catch(() => {
            // Non-critical: a missed heartbeat doesn't interrupt local playback.
          });
      }, HEARTBEAT_INTERVAL_MS);
    } catch {
      // Session tracking is best-effort; playback continues regardless.
      setActiveSessionToken(null);
    }
  }, [clearHeartbeat, flushAccumulatedSeconds, setActiveSessionToken]);

  const endActiveSession = useCallback(
    (completed = false) => {
      const token = sessionTokenRef.current;
      if (!token) return;
      setActiveSessionToken(null);
      clearHeartbeat();

      const delta = flushAccumulatedSeconds();
      const positionSeconds = audioRef.current?.currentTime || 0;
      playbackApi.endSession(token, { positionSeconds, listenedDeltaSeconds: delta, completed }).catch(() => {
        // Non-critical.
      });
    },
    [clearHeartbeat, flushAccumulatedSeconds, setActiveSessionToken]
  );

  // --- Loading a song into the audio element ------------------------------

  const loadIntoAudio = useCallback((song, { autoplay = true, startAtSeconds = 0 } = {}) => {
    const audio = audioRef.current;
    if (!audio || !song) return;

    setIsLoading(true);
    setError(null);
    setCurrentTime(startAtSeconds);
    setBufferedTime(0);
    setDuration(song.durationSeconds || 0);
    lastTimeUpdateRef.current = startAtSeconds;

    const src = buildMediaUrl(song.streamUrl);
    if (!src) {
      setIsLoading(false);
      setError("This song is no longer available.");
      return;
    }

    audio.src = src;
    audio.load();
    if (startAtSeconds > 0) {
      const applyStart = () => {
        audio.currentTime = startAtSeconds;
        audio.removeEventListener("loadedmetadata", applyStart);
      };
      audio.addEventListener("loadedmetadata", applyStart);
    }

    if (autoplay) {
      audio.play().catch(() => {
        // Autoplay can be rejected by the browser; the user can press Play.
        setIsPlaying(false);
      });
    }
  }, []);

  const goToIndex = useCallback(
    (index, { autoplay = true, startAtSeconds = 0 } = {}) => {
      const items = queueStateRef.current.items;
      const song = items[index];
      if (!song) return;

      endActiveSession(false);
      setQueueState((prev) => ({ ...prev, currentIndex: index }));
      loadIntoAudio(song, { autoplay, startAtSeconds });
    },
    [endActiveSession, loadIntoAudio, setQueueState]
  );

  // --- Public queue actions ------------------------------------------------

  const playQueue = useCallback(
    (songs, startIndex = 0) => {
      const playable = (songs || []).filter((song) => song.isPublished !== false);
      if (playable.length === 0) {
        setError("None of these songs are available to play.");
        return;
      }

      const clickedId = songs[startIndex]?.id;
      let index = playable.findIndex((song) => String(song.id) === String(clickedId));
      if (index === -1) index = 0;

      endActiveSession(false);

      const ordered = shuffleEnabled ? buildShuffledQueue(playable, index) : { items: playable, currentIndex: index };
      setQueueState({ items: ordered.items, originalItems: playable, currentIndex: ordered.currentIndex });
      loadIntoAudio(ordered.items[ordered.currentIndex], { autoplay: true });
      setQueueDrawerOpen(false);
    },
    [endActiveSession, loadIntoAudio, setQueueState, shuffleEnabled]
  );

  const playSong = useCallback((song) => playQueue([song], 0), [playQueue]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !queueStateRef.current.items[queueStateRef.current.currentIndex]) return;
    if (audio.paused) {
      audio.play().catch(() => setError("Playback was blocked by the browser. Press Play to continue."));
    } else {
      audio.pause();
    }
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => setError("Playback was blocked by the browser. Press Play to continue."));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const next = useCallback(() => {
    const { currentIndex, items } = queueStateRef.current;
    const nextIndex = getNextIndex({ currentIndex, length: items.length, repeatMode: repeatModeRef.current });
    if (nextIndex === null) return;
    goToIndex(nextIndex);
  }, [goToIndex]);

  const previous = useCallback(() => {
    const { currentIndex, items } = queueStateRef.current;
    const currentTimeSeconds = audioRef.current?.currentTime || 0;
    const prevIndex = getPreviousIndex({
      currentIndex,
      length: items.length,
      repeatMode: repeatModeRef.current,
      currentTimeSeconds,
    });

    if (prevIndex === currentIndex) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    goToIndex(prevIndex);
  }, [goToIndex]);

  const jumpToQueueItem = useCallback(
    (index) => {
      if (index === queueStateRef.current.currentIndex) {
        if (audioRef.current) audioRef.current.currentTime = 0;
        setCurrentTime(0);
        return;
      }
      goToIndex(index);
    },
    [goToIndex]
  );

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = clamp(seconds, 0, duration || seconds);
    audio.currentTime = target;
    setCurrentTime(target);
    // A user-initiated seek shouldn't count as elapsed listening time.
    lastTimeUpdateRef.current = target;
  }, [duration]);

  const setVolume = useCallback((value) => {
    const audio = audioRef.current;
    const next = clamp(value, 0, 1);
    if (audio) {
      audio.volume = next;
      if (next > 0 && audio.muted) audio.muted = false;
    }
    setVolumeState(next);
    setIsMuted(next === 0 ? isMuted : false);
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled((prevEnabled) => {
      const nextEnabled = !prevEnabled;
      setQueueState((prev) => {
        const currentId = prev.items[prev.currentIndex]?.id;
        if (nextEnabled) {
          const shuffled = buildShuffledQueue(prev.items, prev.currentIndex);
          return { ...prev, items: shuffled.items, currentIndex: shuffled.currentIndex };
        }
        const restored = restoreOriginalQueue(prev.originalItems, currentId);
        return { ...prev, items: restored.items, currentIndex: restored.currentIndex };
      });
      return nextEnabled;
    });
  }, [setQueueState]);

  const cycleRepeatMode = useCallback(() => {
    const order = ["off", "all", "one"];
    const nextMode = order[(order.indexOf(repeatModeRef.current) + 1) % order.length];
    setRepeatMode(nextMode);
  }, [setRepeatMode]);

  const playNext = useCallback(
    (song) => {
      setQueueState((prev) => {
        if (prev.items.length === 0) return prev;
        const insertAt = prev.currentIndex + 1;
        const items = prev.items.slice(0, insertAt).concat([song], prev.items.slice(insertAt));
        const originalItems = prev.originalItems.concat([song]);
        return { ...prev, items, originalItems };
      });
    },
    [setQueueState]
  );

  const addToQueue = useCallback(
    (song) => {
      setQueueState((prev) => ({
        ...prev,
        items: prev.items.concat([song]),
        originalItems: prev.originalItems.concat([song]),
      }));
    },
    [setQueueState]
  );

  const removeFromQueue = useCallback(
    (index) => {
      setQueueState((prev) => {
        const removedIsCurrent = index === prev.currentIndex;
        const { items, currentIndex } = removeQueueItemAt(prev.items, index, prev.currentIndex);
        const removedSong = prev.items[index];
        const originalItems = removedSong
          ? prev.originalItems.filter((song) => song !== removedSong)
          : prev.originalItems;

        if (removedIsCurrent) {
          if (items.length === 0) {
            endActiveSession(false);
            audioRef.current?.pause();
            audioRef.current?.removeAttribute("src");
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            return { items: [], originalItems: [], currentIndex: -1 };
          }
          endActiveSession(false);
          loadIntoAudio(items[currentIndex], { autoplay: isPlaying });
        }

        return { items, originalItems, currentIndex };
      });
    },
    [endActiveSession, isPlaying, loadIntoAudio, setQueueState]
  );

  const moveQueueItem = useCallback(
    (fromIndex, toIndex) => {
      setQueueState((prev) => {
        const currentId = prev.items[prev.currentIndex]?.id;
        const items = moveQueueItemAt(prev.items, fromIndex, toIndex);
        const newIndex = items.findIndex((song) => String(song.id) === String(currentId));
        return { ...prev, items, currentIndex: newIndex === -1 ? prev.currentIndex : newIndex };
      });
    },
    [setQueueState]
  );

  const clearQueue = useCallback(() => {
    endActiveSession(false);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.removeAttribute("src");
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueueState(emptyQueueState);
  }, [endActiveSession, setQueueState]);

  const openQueue = useCallback(() => setQueueDrawerOpen(true), []);
  const closeQueue = useCallback(() => setQueueDrawerOpen(false), []);

  // --- Native audio element event wiring -----------------------------------

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    const handlePlay = () => {
      setIsPlaying(true);
      if (!sessionTokenRef.current) startSessionForCurrentSong();
    };
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => {
      const now = audio.currentTime;
      const delta = now - lastTimeUpdateRef.current;
      if (delta > 0 && delta < MAX_ACCUMULATED_DELTA_SECONDS) {
        accumulatedListenedRef.current += delta;
      }
      lastTimeUpdateRef.current = now;

      const nowMs = Date.now();
      if (nowMs - lastUiUpdateAtRef.current >= UI_UPDATE_MIN_INTERVAL_MS) {
        lastUiUpdateAtRef.current = nowMs;
        setCurrentTime(now);
      }
    };
    const handleProgress = () => {
      setBufferedTime(getBufferedEndSeconds(audio.buffered, audio.currentTime));
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };
    const handleEnded = () => {
      const { currentIndex, items } = queueStateRef.current;
      if (repeatModeRef.current === "one") {
        endActiveSession(true);
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }
      endActiveSession(true);
      // With autoplay-next off, natural completion always stops (regardless
      // of repeat-all/off) — manual Next/Previous still work normally.
      if (!autoplayNextRef.current) {
        setIsPlaying(false);
        return;
      }
      const nextIndex = getNextIndex({ currentIndex, length: items.length, repeatMode: repeatModeRef.current });
      if (nextIndex === null) {
        setIsPlaying(false);
        return;
      }
      goToIndex(nextIndex);
    };
    const handleError = () => {
      setIsLoading(false);
      setIsBuffering(false);
      setError(friendlyMediaError(audio.error));
    };
    const handleVolumeChange = () => {
      setVolumeState(audio.volume);
      setIsMuted(audio.muted);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("progress", handleProgress);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("volumechange", handleVolumeChange);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("volumechange", handleVolumeChange);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
    // Mount once — startSessionForCurrentSong/endActiveSession/goToIndex read
    // fresh state via refs, so they don't need to be dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auth-state lifecycle: restore on login, wipe on logout -------------

  useEffect(() => {
    if (!scope) {
      // Component state was already reset above (render-time); this effect
      // only owns the actual external systems — the audio element, the
      // in-flight session, and this account's persisted storage entry.
      const previousScope = previousScopeRef.current;
      endActiveSession(false);
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.removeAttribute("src");
      if (previousScope) clearPlayerState(previousScope);
      previousScopeRef.current = null;
      hasRestoredRef.current = false;
      return;
    }

    // hasRestoredRef only resets on a genuine scope change (not on a
    // StrictMode double-invoke of the same scope), so restoration runs
    // exactly once per login.
    if (previousScopeRef.current !== scope) {
      previousScopeRef.current = scope;
      hasRestoredRef.current = false;
    }
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const saved = loadPlayerState(userId);
    if (!saved) return;

    // Hydrating several independent pieces of UI state from one external
    // read (localStorage) in one pass, immediately followed by the actual
    // audio-element synchronization below — a legitimate one-time restore,
    // not a "derived state" smell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVolumeState(saved.volume);
    setIsMuted(saved.muted);
    setShuffleEnabled(saved.shuffleEnabled);
    setRepeatMode(saved.repeatMode);
    if (audioRef.current) {
      audioRef.current.volume = saved.volume;
      audioRef.current.muted = saved.muted;
    }

    setQueueState({ items: saved.queue, originalItems: saved.queue, currentIndex: saved.currentIndex });
    loadIntoAudio(saved.queue[saved.currentIndex], { autoplay: false, startAtSeconds: saved.positionSeconds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, userId]);

  // --- Periodic + on-change persistence to localStorage --------------------

  useEffect(() => {
    if (!userId) return undefined;

    if (!rememberPlayerState) {
      // Disabling the preference clears whatever was already saved and
      // stops writing new restoration data — it doesn't linger stale.
      clearPlayerState(userId);
      return undefined;
    }

    const persist = () => {
      if (queueStateRef.current.items.length === 0) return;
      savePlayerState(userId, {
        queue: queueStateRef.current.items,
        currentIndex: queueStateRef.current.currentIndex,
        positionSeconds: audioRef.current?.currentTime || 0,
        volume,
        muted: isMuted,
        shuffleEnabled,
        repeatMode,
      });
    };

    persistTimerRef.current = setInterval(persist, PERSIST_INTERVAL_MS);
    return () => clearInterval(persistTimerRef.current);
  }, [userId, volume, isMuted, shuffleEnabled, repeatMode, rememberPlayerState]);

  // --- Best-effort final update on tab close/hide ---------------------------

  useEffect(() => {
    const handlePageHide = () => {
      const token = sessionTokenRef.current;
      if (!token || !audioRef.current) return;
      const accessToken = getAccessToken();
      const delta = accumulatedListenedRef.current;

      try {
        fetch(`${API_BASE_URL}/playback/sessions/${token}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            positionSeconds: audioRef.current.currentTime || 0,
            listenedDeltaSeconds: delta,
            completed: false,
          }),
          keepalive: true,
          credentials: "include",
        }).catch(() => {});
      } catch {
        // Best-effort only — regular heartbeats already cover most of the loss.
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  useEffect(() => clearHeartbeat, [clearHeartbeat]);

  const currentSong = queueState.items[queueState.currentIndex] || null;

  // --- Media Session API (feature-detected; a no-op where unsupported) ----

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    const mediaSession = navigator.mediaSession;

    const actionHandlers = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["previoustrack", () => previous()],
      ["nexttrack", () => next()],
      [
        "seekbackward",
        (details) => seek(Math.max((audioRef.current?.currentTime || 0) - (details.seekOffset || 10), 0)),
      ],
      ["seekforward", (details) => seek((audioRef.current?.currentTime || 0) + (details.seekOffset || 10))],
      ["seekto", (details) => details.seekTime != null && seek(details.seekTime)],
      ["stop", () => pause()],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Not every action is supported in every browser — safe to skip.
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // Same as above.
        }
      });
    };
  }, [play, pause, previous, next, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      return undefined;
    }

    if (typeof MediaMetadata === "undefined") return undefined;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "",
      artist: currentSong.artist?.name || "",
      album: currentSong.album?.title || "",
      artwork: currentSong.coverUrl
        ? [{ src: buildMediaUrl(currentSong.coverUrl), sizes: "512x512", type: "image/png" }]
        : [],
    });
    return undefined;
  }, [currentSong]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (typeof navigator.mediaSession.setPositionState === "function" && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(Math.max(currentTime, 0), duration),
        });
      } catch {
        // Some browsers reject setPositionState outside certain states.
      }
    }
    return undefined;
  }, [isPlaying, duration, currentTime]);

  const value = useMemo(
    () => ({
      queue: queueState.items,
      currentIndex: queueState.currentIndex,
      currentSong,
      isPlaying,
      isLoading,
      isBuffering,
      currentTime,
      duration,
      bufferedTime,
      volume,
      isMuted,
      shuffleEnabled,
      repeatMode,
      error,
      queueDrawerOpen,
      activePlaybackSession: sessionToken ? { sessionToken } : null,
      playSong,
      playQueue,
      togglePlayPause,
      play,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeatMode,
      playNext,
      addToQueue,
      removeFromQueue,
      moveQueueItem,
      jumpToQueueItem,
      clearQueue,
      openQueue,
      closeQueue,
      dismissError: () => setError(null),
    }),
    [
      queueState,
      currentSong,
      isPlaying,
      isLoading,
      isBuffering,
      currentTime,
      duration,
      bufferedTime,
      volume,
      isMuted,
      shuffleEnabled,
      repeatMode,
      error,
      queueDrawerOpen,
      sessionToken,
      playSong,
      playQueue,
      togglePlayPause,
      play,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeatMode,
      playNext,
      addToQueue,
      removeFromQueue,
      moveQueueItem,
      jumpToQueueItem,
      clearQueue,
      openQueue,
      closeQueue,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
