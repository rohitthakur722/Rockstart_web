// Caches the last-known appearance preferences in localStorage so a reload
// can apply the right theme before React (or a network round-trip) ever
// runs — see index.html's inline bootstrap script, which mirrors this same
// cache key and fallback logic in plain JS. Authenticated preferences always
// come from the server first; this is only a pre-paint cache of them.
const STORAGE_KEY = "rockstar:appearance:v1";

export const loadCachedAppearance = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const saveCachedAppearance = ({ theme, reduceMotion, compactLayout }) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, reduceMotion, compactLayout }));
  } catch {
    // Storage can fail (quota, privacy mode) — appearance still applies for this session.
  }
};

export const clearCachedAppearance = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing meaningful to recover from here.
  }
};

export const resolveSystemTheme = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const resolveSystemReduceMotion = () =>
  Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export const applyAppearanceToDocument = ({ theme, reduceMotion, compactLayout }) => {
  const root = document.documentElement;
  const resolvedTheme = !theme || theme === "system" ? resolveSystemTheme() : theme;
  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-reduce-motion", String(Boolean(reduceMotion)));
  root.setAttribute("data-compact", String(Boolean(compactLayout)));
};
