import { Link } from "react-router-dom";
import { GeneratedArtwork } from "./GeneratedArtwork";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { cn } from "../../utils/cn";

export function MusicCard({ to, title, subtitle, coverUrl, count, variant = "square" }) {
  const resolvedCover = buildMediaUrl(coverUrl);

  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-3.5 transition-colors duration-150 hover:border-rockstar-tan-dark focus-visible:outline-2 focus-visible:outline-rockstar-tan"
    >
      <span
        className={cn(
          "flex aspect-square w-full items-center justify-center overflow-hidden bg-rockstar-atmosphere text-rockstar-tan-dark",
          variant === "circle" ? "rounded-full" : "rounded-[calc(var(--radius-card)-6px)]"
        )}
      >
        {resolvedCover ? (
          <img src={resolvedCover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <GeneratedArtwork seed={to} title={title} artist={subtitle} rounded={false} />
        )}
      </span>
      <span className="space-y-0.5">
        <span className="block truncate text-sm font-medium text-rockstar-text-primary">{title}</span>
        {subtitle && <span className="block truncate text-xs text-rockstar-text-secondary">{subtitle}</span>}
        {count !== undefined && count !== null && (
          <span className="block text-xs text-rockstar-text-secondary">{count}</span>
        )}
      </span>
    </Link>
  );
}
