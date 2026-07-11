import { Button } from "./Button";

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, actionTo, actionAs, children }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-rockstar-border bg-rockstar-surface/40 px-6 py-14 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rockstar-surface-elevated text-rockstar-tan">
          <Icon width={22} height={22} aria-hidden="true" />
        </span>
      )}
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-semibold text-rockstar-text-primary">{title}</h3>
        {description && <p className="text-sm text-rockstar-text-secondary">{description}</p>}
      </div>
      {actionLabel && (
        <Button as={actionAs} to={actionTo} onClick={onAction} variant="secondary" size="sm">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
