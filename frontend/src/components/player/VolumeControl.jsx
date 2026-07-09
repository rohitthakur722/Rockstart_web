import { VolumeIcon, MuteIcon } from "../common/icons";

export function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute, className }) {
  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        aria-pressed={isMuted}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
      >
        {isMuted || volume === 0 ? (
          <MuteIcon width={17} height={17} aria-hidden="true" />
        ) : (
          <VolumeIcon width={17} height={17} aria-hidden="true" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(effectiveVolume * 100)}
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
        aria-label="Volume"
        aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
        className="h-4 w-24 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-rockstar-border [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rockstar-tan-light [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-rockstar-border [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-rockstar-tan-light"
      />
    </div>
  );
}
