// Deterministic, transparent ranking over real catalog/listening signals —
// no machine learning, no external model, nothing that could honestly be
// called "AI". Every score component traces to something the user actually
// did (liked a song, played an artist) or a plain catalog fact (popularity,
// recency), which is what lets the UI show an honest reason label instead of
// a vague "recommended for you".
const REASON = {
  LIKED_ARTIST: "From Artists You Like",
  LISTENING_HISTORY: "Based on Your Listening",
  CATALOG_FALLBACK: "Recommended from Rockstar",
};

const toIdSet = (ids = []) => new Set(ids.map(String));

// log1p keeps a handful of very-high-play-count songs from completely
// drowning out every other signal, while still rewarding popularity.
const popularityScore = (playCount) => Math.log1p(Math.max(0, Number(playCount) || 0));

const recencyScore = (createdAt) => {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  return Math.max(0, 1 - ageDays / 60); // linearly fades out over ~60 days
};

const scoreSong = (song, signals) => {
  const artistId = song.artist?.id != null ? String(song.artist.id) : null;
  const albumId = song.album?.id != null ? String(song.album.id) : null;
  const genreIds = (song.genres || []).map((g) => String(g.id));

  let score = 0;
  let reason = REASON.CATALOG_FALLBACK;

  const likedArtist = artistId && signals.likedArtistIds.has(artistId);
  const recentArtist = artistId && signals.recentArtistIds.has(artistId);
  const likedAlbum = albumId && signals.likedAlbumIds.has(albumId);
  const recentAlbum = albumId && signals.recentAlbumIds.has(albumId);
  const genreOverlap = genreIds.filter((id) => signals.likedGenreIds.has(id)).length;

  if (likedArtist) {
    score += 3;
    reason = REASON.LIKED_ARTIST;
  }
  if (likedAlbum) score += 2;
  if (genreOverlap > 0) {
    score += Math.min(genreOverlap, 3);
    if (reason === REASON.CATALOG_FALLBACK) reason = REASON.LISTENING_HISTORY;
  }
  if (recentArtist) {
    score += 2;
    if (reason === REASON.CATALOG_FALLBACK) reason = REASON.LISTENING_HISTORY;
  }
  if (recentAlbum) score += 1;

  score += popularityScore(song.playCount) * 0.5;
  score += recencyScore(song.createdAt) * 0.5;

  const songId = String(song.id);
  if (signals.likedSongIds.has(songId)) score -= 1; // still eligible, just deprioritized
  if (signals.recentlyPlayedSongIds.has(songId)) score -= 4; // avoid over-recommending repeats

  return { song, score, reason };
};

/**
 * @param {object[]} candidates - published songs eligible for recommendation
 * @param {object} signals - { likedSongIds, likedArtistIds, likedAlbumIds, likedGenreIds,
 *   recentArtistIds, recentAlbumIds, recentlyPlayedSongIds } — all arrays of ids
 * @param {number} limit - max results
 * @param {boolean} excludeLiked - drop already-liked songs, but only when
 *   enough non-liked candidates remain to still fill the limit
 */
const rankRecommendations = ({ candidates, signals, limit, excludeLiked = true }) => {
  const normalizedSignals = {
    likedSongIds: toIdSet(signals.likedSongIds),
    likedArtistIds: toIdSet(signals.likedArtistIds),
    likedAlbumIds: toIdSet(signals.likedAlbumIds),
    likedGenreIds: toIdSet(signals.likedGenreIds),
    recentArtistIds: toIdSet(signals.recentArtistIds),
    recentAlbumIds: toIdSet(signals.recentAlbumIds),
    recentlyPlayedSongIds: toIdSet(signals.recentlyPlayedSongIds),
  };

  let pool = candidates;
  if (excludeLiked) {
    const nonLiked = candidates.filter((song) => !normalizedSignals.likedSongIds.has(String(song.id)));
    if (nonLiked.length >= limit) pool = nonLiked;
  }

  const scored = pool.map((song) => scoreSong(song, normalizedSignals));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.song.playCount !== a.song.playCount) return (b.song.playCount || 0) - (a.song.playCount || 0);
    return String(a.song.id).localeCompare(String(b.song.id), "en", { numeric: true });
  });

  const seen = new Set();
  const ranked = [];
  for (const entry of scored) {
    const id = String(entry.song.id);
    if (seen.has(id)) continue;
    seen.add(id);
    ranked.push(entry);
    if (ranked.length >= limit) break;
  }

  return ranked;
};

module.exports = { rankRecommendations, REASON };
