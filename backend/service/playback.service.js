const crypto = require("crypto");
const playbackHistoryModel = require("../model/playbackHistory.model");
const songModel = require("../model/song.model");
const { withTransaction } = require("../config/db");
const AppError = require("../utils/AppError");
const { getQualificationThresholdSeconds, isQualified } = require("../utils/playbackQualification");

// A heartbeat's reported delta is trusted only up to how much wall-clock time
// has actually passed since the session started, plus a small tolerance for
// network latency and heartbeat jitter — this is what stops a manipulated or
// buggy client from claiming more listening time than physically occurred.
const ELAPSED_TOLERANCE_SECONDS = 15;

const startSession = async (userId, songId) => {
  const song = await songModel.findStreamInfoById(songId);
  if (!song || !song.is_published) {
    throw new AppError("Song not found.", 404);
  }

  const sessionToken = crypto.randomUUID();
  const session = await playbackHistoryModel.createSession({ userId, songId, sessionToken });
  const qualificationThresholdSeconds = getQualificationThresholdSeconds(song.duration_seconds);

  return {
    sessionToken: session.session_token,
    durationSeconds: song.duration_seconds,
    qualificationThresholdSeconds,
  };
};

const loadOwnedSession = async (userId, sessionToken, client) => {
  const session = await playbackHistoryModel.lockSessionByToken(sessionToken, client);
  if (!session || String(session.user_id) !== String(userId)) {
    throw new AppError("Playback session not found.", 404);
  }
  return session;
};

// Applies one bounded, monotonic progress update and qualifies the session
// exactly once (via the model's qualified_at IS NULL atomic guard) — shared
// by the heartbeat (PATCH) and end-of-session endpoints so both go through
// identical clamping/qualification logic.
const applySafeProgress = async (session, { positionSeconds, listenedDeltaSeconds, completed }, client) => {
  const song = await songModel.findStreamInfoById(session.song_id);
  const duration = song?.duration_seconds ?? null;

  const sessionStartMs = new Date(session.played_at).getTime();
  const serverElapsedSeconds = Math.max(0, (Date.now() - sessionStartMs) / 1000);
  const maxAllowedListenedSeconds = serverElapsedSeconds + ELAPSED_TOLERANCE_SECONDS;

  const clampedPositionSeconds = duration
    ? Math.min(Math.max(0, positionSeconds), duration)
    : Math.max(0, positionSeconds);

  const requestedListenedSeconds = session.listened_seconds + listenedDeltaSeconds;
  const newListenedSeconds = Math.max(
    session.listened_seconds,
    Math.min(requestedListenedSeconds, maxAllowedListenedSeconds)
  );

  await playbackHistoryModel.updateProgress(
    session.id,
    {
      positionSeconds: Math.round(clampedPositionSeconds),
      listenedSeconds: Math.round(newListenedSeconds),
      completed: Boolean(completed),
    },
    client
  );

  let qualified = Boolean(session.qualified_at);
  if (!qualified && duration !== null && isQualified(newListenedSeconds, duration)) {
    qualified = await playbackHistoryModel.markQualified(session.id, client);
    if (qualified) {
      await playbackHistoryModel.incrementSongPlayCount(session.song_id, client);
    }
  }

  return {
    positionSeconds: Math.round(clampedPositionSeconds),
    listenedSeconds: Math.round(newListenedSeconds),
    qualified,
    qualificationThresholdSeconds: getQualificationThresholdSeconds(duration),
  };
};

const recordProgress = async (userId, sessionToken, progress) => {
  return withTransaction(async (client) => {
    const session = await loadOwnedSession(userId, sessionToken, client);
    if (session.ended_at) {
      throw new AppError("This playback session has already ended.", 409);
    }
    return applySafeProgress(session, progress, client);
  });
};

const endSession = async (userId, sessionToken, progress) => {
  return withTransaction(async (client) => {
    const session = await loadOwnedSession(userId, sessionToken, client);
    const result = await applySafeProgress(session, progress, client);
    await playbackHistoryModel.endSession(session.id, client);
    return result;
  });
};

module.exports = { startSession, recordProgress, endSession };
