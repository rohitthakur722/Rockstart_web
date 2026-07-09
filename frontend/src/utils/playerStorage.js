// Persists only non-sensitive playback preferences/position — never tokens.
// Keyed per-user so one browser profile can never load account A's queue
// under account B's session, even before any in-memory auth check runs.
const STORAGE_VERSION = 1;
const MAX_QUEUE_SIZE = 200;
const STORAGE_PREFIX = "rockstar:player:v1:";

const storageKey = (userId) => `${STORAGE_PREFIX}${userId}`;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const isValidSongSnapshot = (song) =>
  song &&
  typeof song === "object" &&
  (typeof song.id === "string" || typeof song.id === "number") &&
  typeof song.title === "string";

const REPEAT_MODES = new Set(["off", "all", "one"]);

const isValidState = (parsed, userId) => {
  if (!parsed || typeof parsed !== "object") return false;
  if (parsed.version !== STORAGE_VERSION) return false;
  if (String(parsed.userId) !== String(userId)) return false;
  if (!Array.isArray(parsed.queue) || parsed.queue.length === 0) return false;
  if (parsed.queue.length > MAX_QUEUE_SIZE) return false;
  if (!parsed.queue.every(isValidSongSnapshot)) return false;
  if (!Number.isInteger(parsed.currentIndex) || parsed.currentIndex < 0 || parsed.currentIndex >= parsed.queue.length) {
    return false;
  }
  if (!isFiniteNumber(parsed.positionSeconds) || parsed.positionSeconds < 0) return false;
  if (!isFiniteNumber(parsed.volume) || parsed.volume < 0 || parsed.volume > 1) return false;
  if (typeof parsed.muted !== "boolean") return false;
  if (typeof parsed.shuffleEnabled !== "boolean") return false;
  if (!REPEAT_MODES.has(parsed.repeatMode)) return false;
  return true;
};

export const savePlayerState = (userId, state) => {
  if (!userId) return;
  try {
    const payload = {
      version: STORAGE_VERSION,
      userId: String(userId),
      savedAt: new Date().toISOString(),
      queue: state.queue.slice(0, MAX_QUEUE_SIZE),
      currentIndex: state.currentIndex,
      positionSeconds: state.positionSeconds,
      volume: state.volume,
      muted: state.muted,
      shuffleEnabled: state.shuffleEnabled,
      repeatMode: state.repeatMode,
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Storage can fail (quota, privacy mode) — playback continues either way.
  }
};

export const loadPlayerState = (userId) => {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidState(parsed, userId) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearPlayerState = (userId) => {
  if (!userId) return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Ignore — nothing meaningful to recover from here.
  }
};
