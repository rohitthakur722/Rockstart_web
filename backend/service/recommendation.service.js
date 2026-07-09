const likeModel = require("../model/like.model");
const playbackHistoryModel = require("../model/playbackHistory.model");
const songModel = require("../model/song.model");
const { mapSong } = require("../utils/catalogMapper");
const { rankRecommendations } = require("../utils/recommendationRanking");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const CANDIDATE_POOL_LIMIT = 150;
const ARTIST_POOL_LIMIT = 60;
const RECENT_SIGNAL_LIMIT = 20;
const RECENTLY_PLAYED_EXCLUDE_LIMIT = 15;

const resolveLimit = (raw) => {
  const num = parseInt(raw, 10);
  if (!Number.isInteger(num) || num < 1) return DEFAULT_LIMIT;
  return Math.min(num, MAX_LIMIT);
};

const getRecommendations = async (userId, query = {}) => {
  const limit = resolveLimit(query.limit);

  const [likedIds, likedSignals, recentArtistAlbumRows, recentlyPlayedIds, popularRows, recentlyAddedRows] =
    await Promise.all([
      likeModel.findLikedIds(userId),
      likeModel.findLikedSignals(userId),
      playbackHistoryModel.findRecentPlayedArtistAlbumIds(userId, RECENT_SIGNAL_LIMIT),
      playbackHistoryModel.findRecentlyPlayedSongIds(userId, RECENTLY_PLAYED_EXCLUDE_LIMIT),
      songModel.findPopular(CANDIDATE_POOL_LIMIT),
      songModel.findRecentlyAdded(CANDIDATE_POOL_LIMIT),
    ]);

  const recentArtistIds = recentArtistAlbumRows.map((row) => row.artist_id).filter(Boolean);
  const recentAlbumIds = recentArtistAlbumRows.map((row) => row.album_id).filter(Boolean);

  const signalArtistIds = Array.from(new Set([...likedSignals.artistIds, ...recentArtistIds].map(String)));
  const artistPoolRows = signalArtistIds.length > 0
    ? await songModel.findPublishedByArtistIds(signalArtistIds, ARTIST_POOL_LIMIT)
    : [];

  const viewer = { id: userId, role: "user" };
  const candidateMap = new Map();
  for (const row of [...popularRows, ...recentlyAddedRows, ...artistPoolRows]) {
    candidateMap.set(String(row.id), mapSong(row, { viewer }));
  }

  const ranked = rankRecommendations({
    candidates: Array.from(candidateMap.values()),
    signals: {
      likedSongIds: likedIds,
      likedArtistIds: likedSignals.artistIds,
      likedAlbumIds: likedSignals.albumIds,
      likedGenreIds: likedSignals.genreIds,
      recentArtistIds,
      recentAlbumIds,
      recentlyPlayedSongIds: recentlyPlayedIds,
    },
    limit,
  });

  return ranked.map(({ song, reason }) => ({ ...song, recommendationReason: reason }));
};

module.exports = { getRecommendations };
