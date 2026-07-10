import { useMemo } from "react";
import { cn } from "../../utils/cn";

// Restrained, professional palette pulled from the RockStar identity itself
// (near-black surfaces, warm tan/gold accents) — never bright, playful, or
// game-like. Each combination is deterministic per seed, so the same track
// always renders the same design.
const PALETTES = [
  { from: "#1a1512", to: "#2a2118", accent: "#c9a15f" },
  { from: "#14110f", to: "#241c14", accent: "#e8c98a" },
  { from: "#1c1712", to: "#2e2416", accent: "#b98d4a" },
  { from: "#171310", to: "#26201a", accent: "#d9b876" },
  { from: "#1a1310", to: "#2a1f16", accent: "#caa668" },
];

const SHAPES = ["rings", "bars", "waves"];

// Small, fast, non-cryptographic string hash (FNV-1a) — deterministic and
// synchronous, which is all a purely-visual seed needs.
const hashSeed = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const initialsFrom = (title, artist) => {
  const source = (title || artist || "").trim();
  if (!source) return "R";
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const RingsShape = ({ accent }) => (
  <>
    <circle cx="50" cy="50" r="34" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.45" />
    <circle cx="50" cy="50" r="24" fill="none" stroke={accent} strokeWidth="1" opacity="0.3" />
  </>
);

const BarsShape = ({ accent }) => (
  <g opacity="0.4">
    <rect x="20" y="55" width="6" height="20" fill={accent} rx="1.5" />
    <rect x="32" y="42" width="6" height="33" fill={accent} rx="1.5" />
    <rect x="44" y="30" width="6" height="45" fill={accent} rx="1.5" />
    <rect x="56" y="46" width="6" height="29" fill={accent} rx="1.5" />
    <rect x="68" y="38" width="6" height="37" fill={accent} rx="1.5" />
  </g>
);

const WavesShape = ({ accent }) => (
  <path
    d="M10 55 Q 25 35, 40 55 T 70 55 T 100 55"
    fill="none"
    stroke={accent}
    strokeWidth="2"
    opacity="0.4"
  />
);

const SHAPE_COMPONENTS = { rings: RingsShape, bars: BarsShape, waves: WavesShape };

// Deterministic cover art for tracks with no embedded/uploaded artwork —
// never a random remote image. `seed` should be something stable per track
// (id, or title+artist+trackNumber).
export function GeneratedArtwork({ seed, title, artist, className, rounded = true }) {
  const design = useMemo(() => {
    const hash = hashSeed(String(seed || title || artist || "rockstar"));
    const palette = PALETTES[hash % PALETTES.length];
    const shape = SHAPES[Math.floor(hash / PALETTES.length) % SHAPES.length];
    const initials = initialsFrom(title, artist);
    const gradientId = `ga-grad-${hash.toString(36)}`;
    return { palette, shape, initials, gradientId };
  }, [seed, title, artist]);

  const Shape = SHAPE_COMPONENTS[design.shape];

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ? `Generated cover art for ${title}` : "Generated cover art"}
      className={cn("h-full w-full", rounded && "rounded-[inherit]", className)}
    >
      <defs>
        <linearGradient id={design.gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={design.palette.from} />
          <stop offset="100%" stopColor={design.palette.to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${design.gradientId})`} />
      <Shape accent={design.palette.accent} />
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="30"
        fill={design.palette.accent}
      >
        {design.initials}
      </text>
    </svg>
  );
}
