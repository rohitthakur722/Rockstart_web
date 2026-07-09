const playbackHistoryModel = require("../model/playbackHistory.model");
const { mapSong } = require("../utils/catalogMapper");

const DEFAULT_RECENT_LIMIT = 20;
const MAX_RECENT_LIMIT = 50;
const MOST_PLAYED_LIMIT = 5;

const resolveLimit = (raw) => {
  const num = parseInt(raw, 10);
  if (!Number.isInteger(num) || num < 1) return DEFAULT_RECENT_LIMIT;
  return Math.min(num, MAX_RECENT_LIMIT);
};

const getRecentHistory = async (userId, query = {}) => {
  const limit = resolveLimit(query.limit);
  const rows = await playbackHistoryModel.findRecentQualified({ userId, limit });

  return rows.map((row) => ({
    ...mapSong(row, { viewer: { id: userId, role: "user" } }),
    lastPlayedAt: row.last_played_at,
  }));
};

const getStats = async (userId) => {
  const [summary, topArtist, topAlbum, mostPlayed] = await Promise.all([
    playbackHistoryModel.getSummaryStats(userId),
    playbackHistoryModel.getTopArtist(userId),
    playbackHistoryModel.getTopAlbum(userId),
    playbackHistoryModel.getMostPlayedSongs(userId, MOST_PLAYED_LIMIT),
  ]);

  return {
    totalQualifiedPlays: Number(summary.total_qualified_plays) || 0,
    totalListenedSeconds: Number(summary.total_listened_seconds) || 0,
    uniqueSongsPlayed: Number(summary.unique_songs_played) || 0,
    recentListeningCount: Number(summary.recent_listening_count) || 0,
    topArtist: topArtist ? { id: topArtist.id, name: topArtist.name, playCount: Number(topArtist.play_count) } : null,
    topAlbum: topAlbum ? { id: topAlbum.id, title: topAlbum.title, playCount: Number(topAlbum.play_count) } : null,
    mostPlayedSongs: mostPlayed.map((row) => ({
      ...mapSong(row, { viewer: { id: userId, role: "user" } }),
      userPlayCount: Number(row.user_play_count),
    })),
  };
};

const clearHistory = async (userId) => {
  await playbackHistoryModel.deleteAllForUser(userId);
};

module.exports = { getRecentHistory, getStats, clearHistory };
