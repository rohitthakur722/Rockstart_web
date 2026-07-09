import { useEffect, useState } from "react";
import { getAppInfo } from "../api/appApi";

// Module-level cache — every component that wants the version (Sidebar,
// Settings > About) shares one request instead of each firing its own.
let cachedInfo = null;
let inFlight = null;

export function useAppVersion() {
  const [info, setInfo] = useState(cachedInfo);

  useEffect(() => {
    if (cachedInfo) return undefined;

    let cancelled = false;
    inFlight =
      inFlight ||
      getAppInfo()
        .then((res) => {
          cachedInfo = { version: res.data.version, phase: res.data.phase };
          return cachedInfo;
        })
        .finally(() => {
          inFlight = null;
        });

    inFlight.then((result) => {
      if (!cancelled) setInfo(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
