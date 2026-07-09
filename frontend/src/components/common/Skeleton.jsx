import { cn } from "../../utils/cn";

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--radius-field)] bg-rockstar-surface-elevated", className)}
    />
  );
}

export function MusicCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-3.5">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SongRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}
