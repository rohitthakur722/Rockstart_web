const userModel = require("../model/user.model");
const likeModel = require("../model/like.model");
const playlistModel = require("../model/playlist.model");
const playbackHistoryModel = require("../model/playbackHistory.model");
const songModel = require("../model/song.model");
const userPreferenceService = require("./userPreference.service");
const { mapSong } = require("../utils/catalogMapper");

// Deliberately bounded — this is a personal-data export, not a full
// database dump. Generous enough to cover a real user's history/uploads
// without risking an unbounded query.
const EXPORT_LIST_LIMIT = 1000;

const mapPlaylistWithSongs = async (playlistRow) => {
  const songs = await playlistModel.findSongs(playlistRow.id);
  return {
    id: playlistRow.id,
    name: playlistRow.name,
    description: playlistRow.description,
    createdAt: playlistRow.created_at,
    updatedAt: playlistRow.updated_at,
    songs: songs.map((row) => ({ songId: row.id, title: row.title, position: row.position })),
  };
};

const buildExport = async (userId) => {
  const [user, preferences, likedSongIds, playlistRows, qualifiedHistory, uploadedRows] = await Promise.all([
    userModel.findById(userId),
    userPreferenceService.getPreferences(userId),
    likeModel.findLikedIds(userId),
    playlistModel.findAllByUser(userId),
    playbackHistoryModel.findRecentQualified({ userId, limit: EXPORT_LIST_LIMIT }),
    songModel.findMineList({ userId, status: "all", search: "", sort: "createdAt", order: "DESC", limit: EXPORT_LIST_LIMIT, offset: 0 }),
  ]);

  const playlists = await Promise.all(playlistRows.map(mapPlaylistWithSongs));

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
    preferences,
    likedSongIds,
    playlists,
    qualifiedListeningHistory: qualifiedHistory.map((row) => ({
      songId: row.song_id,
      title: row.title,
      lastPlayedAt: row.last_played_at,
    })),
    uploadedSongs: uploadedRows.map((row) => mapSong(row, { viewer: { id: userId, role: "user" } })),
  };
};

module.exports = { buildExport };
