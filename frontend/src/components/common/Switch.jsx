import { useId } from "react";

// role="switch" + aria-checked communicates state to assistive tech; the
// visual thumb position is a secondary cue, never the only one — the
// surrounding label/description text always states the current meaning too.
export function Switch({ label, description, checked, onChange, disabled = false }) {
  const labelId = useId();
  const descriptionId = description ? `${labelId}-desc` : undefined;

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-rockstar-text-primary">
          {label}
        </p>
        {description && (
          <p id={descriptionId} className="text-xs text-rockstar-text-secondary">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rockstar-tan disabled:opacity-50 ${
          checked ? "bg-rockstar-gradient" : "bg-rockstar-surface-elevated border border-rockstar-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-rockstar-text-primary shadow transition-transform duration-150 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
