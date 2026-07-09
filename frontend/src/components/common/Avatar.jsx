import { useState } from "react";
import { cn } from "../../utils/cn";
import { buildAvatarUrl, getInitials } from "../../utils/avatarUrl";

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
};

export function Avatar({ avatarUrl, name, size = "md", className }) {
  const [broken, setBroken] = useState(false);
  const resolvedUrl = buildAvatarUrl(avatarUrl);
  const showImage = resolvedUrl && !broken;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-rockstar-border bg-rockstar-surface-elevated font-semibold text-rockstar-text-secondary",
        SIZES[size],
        className
      )}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}
