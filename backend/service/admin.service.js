const adminModel = require("../model/admin.model");
const songModel = require("../model/song.model");
const playbackHistoryModel = require("../model/playbackHistory.model");
const { mapSong } = require("../utils/catalogMapper");

const RECENT_LIST_LIMIT = 8;
const MOST_PLAYED_LIMIT = 8;

const mapRecentRegistration = (row) => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username,
  email: row.email,
  role: row.role,
  isActive: row.is_active,
  createdAt: row.created_at,
});

const mapRecentUpload = (row) => ({
  id: row.id,
  title: row.title,
  isPublished: row.is_published,
  createdAt: row.created_at,
  artistName: row.artist_name,
  uploaderFullName: row.uploader_full_name,
});

// All real, current-state metrics — no fabricated growth percentages, no
// charts. "Recent" lists are simple bounded windows, not time-series data.
const getDashboardOverview = async () => {
  const [userCounts, songCounts, catalogCounts, platformStats, recentRegistrations, recentUploads, mostPlayedRows] =
    await Promise.all([
      adminModel.getUserCounts(),
      adminModel.getSongCounts(),
      adminModel.getCatalogCounts(),
      playbackHistoryModel.getPlatformSummaryStats(),
      adminModel.findRecentRegistrations(RECENT_LIST_LIMIT),
      adminModel.findRecentUploads(RECENT_LIST_LIMIT),
      songModel.findPopular(MOST_PLAYED_LIMIT),
    ]);

  return {
    users: {
      total: Number(userCounts.total),
      active: Number(userCounts.active),
      suspended: Number(userCounts.suspended),
      administrators: Number(userCounts.administrators),
    },
    songs: {
      total: Number(songCounts.total),
      published: Number(songCounts.published),
      draft: Number(songCounts.draft),
    },
    catalog: {
      artists: Number(catalogCounts.artists),
      albums: Number(catalogCounts.albums),
      genres: Number(catalogCounts.genres),
      playlists: Number(catalogCounts.playlists),
    },
    listening: {
      qualifiedPlays: Number(platformStats.total_qualified_plays),
      totalListenedSeconds: Number(platformStats.total_listened_seconds),
    },
    recentRegistrations: recentRegistrations.map(mapRecentRegistration),
    recentUploads: recentUploads.map(mapRecentUpload),
    mostPlayedSongs: mostPlayedRows.map((row) => mapSong(row)),
  };
};

module.exports = { getDashboardOverview };
