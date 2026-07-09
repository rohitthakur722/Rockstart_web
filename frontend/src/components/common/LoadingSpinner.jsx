import { cn } from "../../utils/cn";

export function LoadingSpinner({ label = "Loading", size = "md", className }) {
  const sizes = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-9 w-9 border-[3px]" };

  return (
    <div role="status" className={cn("flex items-center justify-center gap-3", className)}>
      <span
        className={cn(
          "animate-spin rounded-full border-rockstar-border border-t-rockstar-tan",
          sizes[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
