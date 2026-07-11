// Deterministic, original SVG cover art for the RockStar Demo Library — no
// downloaded images, no real album art, no celebrity photos. Album tracks
// share a base visual system (palette + motif) with a small per-track
// variation, mirroring the frontend's GeneratedArtwork component's design
// language (near-black/charcoal foundations, warm tan/gold + muted bronze
// accents, restrained geometry, initials).

const PALETTES = [
  { bg0: "#0d0b0a", bg1: "#1a1512", accent: "#c9a15f", accent2: "#8a6a3d" },
  { bg0: "#100e0c", bg1: "#221a12", accent: "#e8c98a", accent2: "#a9884f" },
  { bg0: "#0e0c0b", bg1: "#1e1712", accent: "#d9b876", accent2: "#8f7248" },
  { bg0: "#0f0d0b", bg1: "#241d15", accent: "#caa668", accent2: "#7c5f38" },
];

const MOTIFS = ["rings", "bars", "waveform", "vinyl"];

const hashSeed = (input) => {
  let hash = 0x811c9dc5;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const initialsFrom = (text) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const ringsMotif = (accent, accent2) => `
  <circle cx="400" cy="400" r="260" fill="none" stroke="${accent}" stroke-width="3" opacity="0.35" />
  <circle cx="400" cy="400" r="190" fill="none" stroke="${accent2}" stroke-width="2" opacity="0.3" />
  <circle cx="400" cy="400" r="120" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.25" />
`;

const barsMotif = (accent) => {
  const heights = [90, 160, 230, 130, 190, 110, 150];
  const barWidth = 34;
  const gap = 14;
  const totalWidth = heights.length * barWidth + (heights.length - 1) * gap;
  const startX = 400 - totalWidth / 2;
  return heights
    .map((h, i) => {
      const x = startX + i * (barWidth + gap);
      const y = 460 - h;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" fill="${accent}" opacity="0.4" />`;
    })
    .join("\n  ");
};

const waveformMotif = (accent) => {
  let path = "M 90 400 ";
  const points = 24;
  for (let i = 0; i <= points; i += 1) {
    const x = 90 + (620 / points) * i;
    const amplitude = 60 + 50 * Math.sin(i * 0.9) * Math.cos(i * 0.35);
    path += `Q ${x - 620 / points / 2} ${400 - amplitude}, ${x} 400 `;
  }
  return `<path d="${path}" fill="none" stroke="${accent}" stroke-width="3" opacity="0.4" stroke-linecap="round" />`;
};

const vinylMotif = (accent, accent2) => `
  <circle cx="400" cy="400" r="280" fill="none" stroke="${accent2}" stroke-width="18" opacity="0.18" />
  <circle cx="400" cy="400" r="280" fill="none" stroke="${accent}" stroke-width="2" opacity="0.3" />
  <circle cx="400" cy="400" r="70" fill="none" stroke="${accent}" stroke-width="2" opacity="0.4" />
  <circle cx="400" cy="400" r="14" fill="${accent}" opacity="0.5" />
`;

const MOTIF_RENDERERS = {
  rings: ringsMotif,
  bars: barsMotif,
  waveform: waveformMotif,
  vinyl: vinylMotif,
};

/**
 * Builds one deterministic SVG cover.
 * @param {object} options
 * @param {string} options.seed - stable identity (e.g. a source key)
 * @param {string} options.title - track or album title
 * @param {string} [options.subtitle] - artist name, shown smaller
 */
const buildDemoCoverSvg = ({ seed, title, subtitle }) => {
  const hash = hashSeed(seed);
  const palette = PALETTES[hash % PALETTES.length];
  const motifName = MOTIFS[Math.floor(hash / PALETTES.length) % MOTIFS.length];
  const renderMotif = MOTIF_RENDERERS[motifName];
  const initials = initialsFrom(title);
  const gradientId = `demo-grad-${hash.toString(36)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg0}" />
      <stop offset="100%" stop-color="${palette.bg1}" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${gradientId})" />
  ${renderMotif(palette.accent, palette.accent2)}
  <text x="400" y="452" text-anchor="middle" font-family="Georgia, serif" font-size="220" fill="${palette.accent}">${initials}</text>
  ${subtitle ? `<text x="400" y="740" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="2" fill="${palette.accent2}">${escapeXml(subtitle.toUpperCase())}</text>` : ""}
</svg>`;
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { buildDemoCoverSvg };
