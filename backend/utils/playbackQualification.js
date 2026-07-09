// A play only "counts" (toward play_count and recent/qualified history) once
// the listener has heard a meaningful portion of the track. This keeps the
// count honest against accidental clicks, Range-request prefetching, and
// scrubbing, without punishing legitimately short tracks.
//
// Threshold = the smaller of: the whole song, a 30s cap (so long songs don't
// require half a minute more than short ones), and 25% of the song's length
// (floored at 5s so very short songs still require *some* listening).
//
// Examples: a 3s clip qualifies after 3s (whole song); a 20s clip after 5s
// (25% floor); a 60s song after 15s; a 120s+ song after the 30s cap.
const getQualificationThresholdSeconds = (durationSeconds) => {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  return Math.min(duration, 30, Math.max(5, Math.ceil(duration * 0.25)));
};

const isQualified = (listenedSeconds, durationSeconds) => {
  const threshold = getQualificationThresholdSeconds(durationSeconds);
  return Number(listenedSeconds) >= threshold;
};

module.exports = { getQualificationThresholdSeconds, isQualified };
