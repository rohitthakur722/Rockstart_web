// Pure queue/shuffle/repeat helpers — no DOM, no React, no side effects — so
// they stay easy to unit test once a test framework is introduced, per the
// project's "structure for later testability" requirement.

// Fisher-Yates; never mutates the input.
export const shuffleArray = (array) => {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Keeps the currently-playing item first (so playback never jumps), shuffles
// everything else. Returns a fresh queue + the new index of the current item
// (always 0) — callers keep the pre-shuffle order elsewhere to un-shuffle.
export const buildShuffledQueue = (items, currentIndex) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], currentIndex: -1 };
  }
  const safeIndex = Math.min(Math.max(currentIndex, 0), items.length - 1);
  const current = items[safeIndex];
  const rest = items.filter((_, i) => i !== safeIndex);
  return { items: [current, ...shuffleArray(rest)], currentIndex: 0 };
};

// Restores original (pre-shuffle) order, relocating the current song's index.
export const restoreOriginalQueue = (originalItems, currentSongId) => {
  const currentIndex = originalItems.findIndex((song) => String(song.id) === String(currentSongId));
  return { items: originalItems, currentIndex: Math.max(currentIndex, 0) };
};

// null return means "stop" (end of queue with repeat off).
export const getNextIndex = ({ currentIndex, length, repeatMode }) => {
  if (length <= 0) return null;
  if (repeatMode === "one") return currentIndex;

  const next = currentIndex + 1;
  if (next < length) return next;
  return repeatMode === "all" ? 0 : null;
};

// Previous never returns null: below the restart threshold it just restarts
// the current track (a valid index), matching standard player behavior.
const RESTART_THRESHOLD_SECONDS = 3;

export const getPreviousIndex = ({ currentIndex, length, repeatMode, currentTimeSeconds }) => {
  if (length <= 0) return 0;
  if (currentTimeSeconds > RESTART_THRESHOLD_SECONDS) return currentIndex;

  const prev = currentIndex - 1;
  if (prev >= 0) return prev;
  return repeatMode === "all" ? length - 1 : 0;
};

export const moveQueueItem = (items, fromIndex, toIndex) => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items.slice();
  }
  const result = items.slice();
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
};

// Removing an item shifts every later index down by one; adjust currentIndex
// so playback position tracks the same song (or clamps sanely at the end).
export const removeQueueItemAt = (items, removeIndex, currentIndex) => {
  if (removeIndex < 0 || removeIndex >= items.length) {
    return { items: items.slice(), currentIndex };
  }

  const nextItems = items.slice(0, removeIndex).concat(items.slice(removeIndex + 1));
  let nextIndex = currentIndex;
  if (removeIndex < currentIndex) nextIndex -= 1;
  else if (removeIndex === currentIndex) nextIndex = Math.min(currentIndex, nextItems.length - 1);

  return { items: nextItems, currentIndex: Math.max(nextIndex, nextItems.length > 0 ? 0 : -1) };
};
