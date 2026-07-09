import { useState } from "react";
import { formatDuration } from "../../utils/duration";
import { computeProgressPercentage, computeBufferedPercentage, percentageToSeconds } from "../../utils/playbackTime";
import { cn } from "../../utils/cn";

export function PlaybackProgress({ currentTime, duration, bufferedTime, onSeek, compact = false }) {
  const [dragPercentage, setDragPercentage] = useState(null);
  const hasDuration = Number.isFinite(duration) && duration > 0;

  const displayedTime = dragPercentage !== null ? percentageToSeconds(dragPercentage, duration) : currentTime;
  const progressPercentage = dragPercentage ?? computeProgressPercentage(currentTime, duration);
  const bufferedPercentage = computeBufferedPercentage(bufferedTime, duration);

  return (
    <div className={cn("flex items-center gap-2", compact ? "text-[10px]" : "text-xs")}>
      {!compact && (
        <span className="w-9 shrink-0 text-right text-rockstar-text-secondary tabular-nums">
          {formatDuration(displayedTime)}
        </span>
      )}
      <div className="relative flex-1">
        <div className="absolute inset-y-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-rockstar-border" />
        <div
          className="absolute inset-y-1/2 h-1 -translate-y-1/2 rounded-full bg-rockstar-tan-dark/50"
          style={{ width: `${bufferedPercentage}%` }}
        />
        <div
          className="absolute inset-y-1/2 h-1 -translate-y-1/2 rounded-full bg-rockstar-tan"
          style={{ width: `${progressPercentage}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progressPercentage}
          disabled={!hasDuration}
          onInput={(event) => setDragPercentage(Number(event.target.value))}
          onChange={(event) => {
            const percentage = Number(event.target.value);
            onSeek(percentageToSeconds(percentage, duration));
            setDragPercentage(null);
          }}
          aria-label="Seek"
          aria-valuetext={`${formatDuration(displayedTime)} of ${formatDuration(duration)}`}
          className="relative z-10 m-0 h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rockstar-tan-light [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-rockstar-tan-light disabled:cursor-not-allowed"
        />
      </div>
      {!compact && (
        <span className="w-9 shrink-0 text-rockstar-text-secondary tabular-nums">{formatDuration(duration)}</span>
      )}
    </div>
  );
}
