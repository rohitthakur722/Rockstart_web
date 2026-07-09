import { useEffect, useState } from "react";
import { getHealth } from "../api/healthApi";

export function useHealthCheck() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then(() => {
        if (!cancelled) setStatus("connected");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
