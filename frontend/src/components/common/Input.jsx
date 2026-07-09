import { useId } from "react";
import { cn } from "../../utils/cn";

export function Input({ label, id, error, hint, className, ref, ...rest }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-rockstar-text-primary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        className={cn(
          "h-11 rounded-[var(--radius-field)] border bg-rockstar-surface px-3.5 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary",
          "outline-none transition-colors duration-150 focus-visible:border-rockstar-tan",
          error ? "border-rockstar-error" : "border-rockstar-border",
          className
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-rockstar-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rockstar-error">
          {error}
        </p>
      )}
    </div>
  );
}
