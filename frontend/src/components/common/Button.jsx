import { cn } from "../../utils/cn";

const VARIANTS = {
  primary:
    "bg-rockstar-gradient text-rockstar-black font-semibold hover:brightness-110 active:brightness-95",
  secondary:
    "bg-rockstar-surface text-rockstar-text-primary border border-rockstar-border hover:border-rockstar-tan-dark",
  ghost:
    "bg-transparent text-rockstar-text-secondary hover:text-rockstar-text-primary hover:bg-rockstar-surface",
  danger:
    "bg-transparent text-rockstar-error border border-rockstar-error/40 hover:bg-rockstar-error/10",
};

const SIZES = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  className,
  children,
  ...rest
}) {
  return (
    <Component
      disabled={Component === "button" ? disabled || loading : undefined}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </Component>
  );
}
