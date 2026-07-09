import { useHealthCheck } from "../../hooks/useHealthCheck";
import { cn } from "../../utils/cn";

const LABELS = {
  loading: "Checking API…",
  connected: "API connected",
  unavailable: "API unavailable",
};

const DOT_COLORS = {
  loading: "bg-rockstar-text-secondary",
  connected: "bg-rockstar-success",
  unavailable: "bg-rockstar-error",
};

export function DevHealthBadge() {
  const status = useHealthCheck();

  if (!import.meta.env.DEV) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-rockstar-border bg-rockstar-surface-elevated px-3 py-1.5 text-xs text-rockstar-text-secondary shadow-lg"
    >
      <span className={cn("h-2 w-2 rounded-full", DOT_COLORS[status])} aria-hidden="true" />
      {LABELS[status]}
    </div>
  );
}
