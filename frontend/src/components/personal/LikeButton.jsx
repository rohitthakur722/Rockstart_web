import { useState } from "react";
import { HeartIcon } from "../common/icons";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";
import { cn } from "../../utils/cn";

const SIZES = {
  sm: { button: "h-8 w-8", icon: 15 },
  md: { button: "h-9 w-9", icon: 17 },
};

export function LikeButton({ song, size = "sm", className }) {
  const { isLiked, toggleLike } = usePersonalLibrary();
  const [pending, setPending] = useState(false);

  if (!song || song.isPublished === false) return null;

  const liked = isLiked(song.id);
  const dimensions = SIZES[size] || SIZES.sm;

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      await toggleLike(song);
    } catch {
      // toggleLike already rolled back optimistic state; nothing further to do here.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? `Unlike ${song.title}` : `Like ${song.title}`}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-60",
        liked ? "text-rockstar-tan" : "text-rockstar-text-secondary hover:text-rockstar-tan-light",
        dimensions.button,
        className
      )}
    >
      <HeartIcon
        width={dimensions.icon}
        height={dimensions.icon}
        fill={liked ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
