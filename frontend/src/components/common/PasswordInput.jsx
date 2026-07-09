import { useId, useState } from "react";
import { cn } from "../../utils/cn";
import { EyeIcon, EyeOffIcon } from "./icons";

export function PasswordInput({ label, id, error, hint, className, ref, ...rest }) {
  const [visible, setVisible] = useState(false);
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
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(errorId, hintId) || undefined}
          className={cn(
            "h-11 w-full rounded-[var(--radius-field)] border bg-rockstar-surface px-3.5 pr-11 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary",
            "outline-none transition-colors duration-150 focus-visible:border-rockstar-tan",
            error ? "border-rockstar-error" : "border-rockstar-border",
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-rockstar-text-secondary hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-[-2px] rounded-r-[var(--radius-field)]"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
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
