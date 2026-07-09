import { AlertIcon, RefreshIcon } from "./icons";
import { Button } from "./Button";

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-rockstar-error/30 bg-rockstar-error/5 px-6 py-14 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rockstar-error/10 text-rockstar-error">
        <AlertIcon width={22} height={22} />
      </span>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-semibold text-rockstar-text-primary">{title}</h3>
        {message && <p className="text-sm text-rockstar-text-secondary">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshIcon width={16} height={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
