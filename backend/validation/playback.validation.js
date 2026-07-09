// A heartbeat is expected every ~10-15s; capping the delta a single request
// may report keeps a manipulated/buggy client from inflating listened_seconds
// or play_count in one shot. Generous enough for the "end" call's own final
// update to slightly overlap the last heartbeat.
const MAX_LISTENED_DELTA_SECONDS = 120;

const validateSongIdInput = (body = {}) => {
  const errors = [];
  const values = {};

  const raw = body.songId;
  if (raw === undefined || raw === null || raw === "") {
    errors.push({ field: "songId", message: "A song ID is required." });
    return { errors, values };
  }

  const id = String(raw).trim();
  if (!/^\d+$/.test(id)) {
    errors.push({ field: "songId", message: "Song ID must be a positive integer." });
    return { errors, values };
  }

  values.songId = id;
  return { errors, values };
};

const validateProgressInput = (body = {}) => {
  const errors = [];
  const values = {};

  const positionSeconds = Number(body.positionSeconds);
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    errors.push({ field: "positionSeconds", message: "positionSeconds must be a non-negative number." });
  } else {
    values.positionSeconds = positionSeconds;
  }

  const listenedDeltaSeconds = Number(body.listenedDeltaSeconds);
  if (!Number.isFinite(listenedDeltaSeconds) || listenedDeltaSeconds < 0) {
    errors.push({ field: "listenedDeltaSeconds", message: "listenedDeltaSeconds must be a non-negative number." });
  } else {
    values.listenedDeltaSeconds = Math.min(listenedDeltaSeconds, MAX_LISTENED_DELTA_SECONDS);
  }

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    errors.push({ field: "completed", message: "completed must be true or false." });
  } else {
    values.completed = Boolean(body.completed);
  }

  return { errors, values };
};

module.exports = { validateSongIdInput, validateProgressInput, MAX_LISTENED_DELTA_SECONDS };
