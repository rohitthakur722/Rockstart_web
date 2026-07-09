// Pure numeric helpers for the seek bar / progress display — kept separate
// from formatDuration (display text) since these guard against NaN/Infinity/
// negative values coming out of the audio element or a drag gesture.

export const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export const computeProgressPercentage = (currentTime, duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp((currentTime / duration) * 100, 0, 100);
};

export const computeBufferedPercentage = (bufferedTime, duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp((bufferedTime / duration) * 100, 0, 100);
};

// Furthest buffered end time across every TimeRanges span, not just the
// first — audio elements can buffer disjoint ranges (e.g. after a seek).
export const getBufferedEndSeconds = (buffered, currentTime) => {
  if (!buffered || buffered.length === 0) return 0;
  let furthest = 0;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime && buffered.end(i) > furthest) {
      furthest = buffered.end(i);
    }
  }
  return furthest;
};

export const percentageToSeconds = (percentage, duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp((percentage / 100) * duration, 0, duration);
};
