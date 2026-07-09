import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as preferenceApi from "../api/preferenceApi";
import { extractErrorMessage } from "../api/axiosInstance";
import {
  loadCachedAppearance,
  saveCachedAppearance,
  clearCachedAppearance,
  resolveSystemReduceMotion,
  applyAppearanceToDocument,
} from "../utils/appearanceStorage";
import { PreferenceContext } from "./PreferenceContext";

const guestDefaults = () => ({
  theme: "system",
  reduceMotion: resolveSystemReduceMotion(),
  compactLayout: false,
  autoplayNext: true,
  rememberPlayerState: true,
  keyboardShortcutsEnabled: true,
});

// Server-backed appearance/playback preferences. Applies to <html> via
// data-* attributes (see index.css) on every change, and caches the last
// known values so a page reload can apply them before this provider even
// finishes its first server round-trip (see index.html's bootstrap script).
export function PreferenceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated && user ? String(user.id) : null;

  const [preferences, setPreferences] = useState(() => ({
    ...guestDefaults(),
    ...(loadCachedAppearance() || {}),
  }));
  const [loadedScope, setLoadedScope] = useState(null);
  const [resolvedScope, setResolvedScope] = useState(null);
  const [error, setError] = useState("");
  const loading = Boolean(scope) && resolvedScope !== scope;

  // Render-time reset on logout/account switch — falls back to guest
  // defaults immediately; the effect below handles the real side effects
  // (server fetch for a new scope, cache clear for a logout).
  if (scope !== loadedScope) {
    setLoadedScope(scope);
    if (!scope) setPreferences(guestDefaults());
  }

  useEffect(() => {
    applyAppearanceToDocument(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!scope) {
      clearCachedAppearance();
      return undefined;
    }

    let cancelled = false;

    preferenceApi
      .getPreferences()
      .then((res) => {
        if (cancelled) return;
        const server = res.data.preferences;
        setPreferences((prev) => ({ ...prev, ...server }));
        saveCachedAppearance(server);
        setResolvedScope(scope);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const updatePreferences = useCallback(
    async (partial) => {
      const previous = preferences;
      const optimistic = { ...previous, ...partial };
      setPreferences(optimistic);
      saveCachedAppearance(optimistic);

      try {
        const res = await preferenceApi.updatePreferences(partial);
        const server = res.data.preferences;
        setPreferences((prev) => ({ ...prev, ...server }));
        saveCachedAppearance(server);
        return server;
      } catch (err) {
        setPreferences(previous);
        saveCachedAppearance(previous);
        throw err;
      }
    },
    [preferences]
  );

  const value = useMemo(
    () => ({ preferences, loading, error, updatePreferences }),
    [preferences, loading, error, updatePreferences]
  );

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}
