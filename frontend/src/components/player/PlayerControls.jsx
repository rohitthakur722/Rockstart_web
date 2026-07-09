import {
  PlayIcon,
  PauseIcon,
  PreviousIcon,
  NextIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
} from "../common/icons";
import { cn } from "../../utils/cn";

const REPEAT_LABELS = {
  off: "Enable repeat",
  all: "Repeat all — press to repeat one",
  one: "Repeat one — press to turn off repeat",
};

function ToggleButton({ active, onClick, label, children, size }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-rockstar-tan",
        size === "lg" ? "h-10 w-10" : "h-8 w-8",
        active ? "text-rockstar-tan" : "text-rockstar-text-secondary hover:text-rockstar-text-primary"
      )}
    >
      {children}
      {active && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-rockstar-tan"
        />
      )}
    </button>
  );
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrevious,
  shuffleEnabled,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  size = "sm",
  disabled = false,
  showShuffleRepeat = true,
}) {
  const iconSize = size === "lg" ? 20 : 16;
  const playIconSize = size === "lg" ? 26 : 18;

  return (
    <div className="flex items-center gap-1">
      {showShuffleRepeat && (
        <ToggleButton active={shuffleEnabled} onClick={onToggleShuffle} label="Shuffle" size={size}>
          <ShuffleIcon width={iconSize} height={iconSize} aria-hidden="true" />
        </ToggleButton>
      )}

      <button
        type="button"
        onClick={onPrevious}
        disabled={disabled}
        aria-label="Previous"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-rockstar-text-primary hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-40",
          size === "lg" ? "h-11 w-11" : "h-8 w-8"
        )}
      >
        <PreviousIcon width={iconSize} height={iconSize} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black hover:brightness-110 focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-40",
          size === "lg" ? "h-14 w-14" : "h-10 w-10"
        )}
      >
        {isPlaying ? (
          <PauseIcon width={playIconSize} height={playIconSize} aria-hidden="true" />
        ) : (
          <PlayIcon width={playIconSize} height={playIconSize} aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label="Next"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-rockstar-text-primary hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-40",
          size === "lg" ? "h-11 w-11" : "h-8 w-8"
        )}
      >
        <NextIcon width={iconSize} height={iconSize} aria-hidden="true" />
      </button>

      {showShuffleRepeat && (
        <ToggleButton active={repeatMode !== "off"} onClick={onCycleRepeat} label={REPEAT_LABELS[repeatMode]} size={size}>
          {repeatMode === "one" ? (
            <RepeatOneIcon width={iconSize} height={iconSize} aria-hidden="true" />
          ) : (
            <RepeatIcon width={iconSize} height={iconSize} aria-hidden="true" />
          )}
        </ToggleButton>
      )}
    </div>
  );
}
