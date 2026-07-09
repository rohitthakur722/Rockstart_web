export function AdminMetricCard({ label, value, hint }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-4">
      <p className="text-xs text-rockstar-text-secondary">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-rockstar-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-rockstar-text-secondary">{hint}</p>}
    </div>
  );
}
