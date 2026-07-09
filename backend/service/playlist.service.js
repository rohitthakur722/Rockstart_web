const playlistModel = require("../model/playlist.model");
const songModel = require("../model/song.model");
const { withTransaction } = require("../config/db");
const AppError = require("../utils/AppError");
const { mapSong } = require("../utils/catalogMapper");

const mapPlaylistSummary = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || null,
  coverUrl: row.cover_url || row.derived_cover_url || null,
  isPublic: row.is_public,
  songCount: Number(row.song_count) || 0,
  unavailableCount: Number(row.unavailable_count) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPlaylistDetail = (row, songRows, viewer) => ({
  ...mapPlaylistSummary(row),
  songs: songRows.map((songRow) => ({
    ...mapSong(songRow, { viewer }),
    position: songRow.position,
    addedAt: songRow.added_at,
  })),
});

const getOwnedPlaylist = async (playlistId, userId, client) => {
  const playlist = await playlistModel.findById(playlistId, client);
  if (!playlist || String(playlist.user_id) !== String(userId)) {
    throw new AppError("Playlist not found.", 404);
  }
  return playlist;
};

const listPlaylists = async (userId) => {
  const rows = await playlistModel.findAllByUser(userId);
  return rows.map(mapPlaylistSummary);
};

const getPlaylistDetail = async (playlistId, userId) => {
  const playlist = await getOwnedPlaylist(playlistId, userId);
  const songs = await playlistModel.findSongs(playlistId);
  return mapPlaylistDetail(playlist, songs, { id: userId, role: "user" });
};

const assertNameAvailable = async (userId, name, client) => {
  const existing = await playlistModel.findByUserAndNameCI(userId, name, client);
  if (existing) {
    throw new AppError("You already have a playlist with this name.", 409, [
      { field: "name", message: "You already have a playlist with this name." },
    ]);
  }
};

const createPlaylist = async (userId, { name, description }) => {
  await assertNameAvailable(userId, name);

  let playlistId;
  try {
    playlistId = await playlistModel.create({ userId, name, description });
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("You already have a playlist with this name.", 409, [
        { field: "name", message: "You already have a playlist with this name." },
      ]);
    }
    throw err;
  }

  const playlist = await playlistModel.findById(playlistId);
  return mapPlaylistDetail(playlist, [], { id: userId, role: "user" });
};

const updatePlaylist = async (playlistId, userId, { name, description }) => {
  await getOwnedPlaylist(playlistId, userId);

  if (name !== undefined) await assertNameAvailable(userId, name);

  try {
    await playlistModel.updateMetadata(playlistId, { name, description });
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("You already have a playlist with this name.", 409, [
        { field: "name", message: "You already have a playlist with this name." },
      ]);
    }
    throw err;
  }

  return getPlaylistDetail(playlistId, userId);
};

const deletePlaylist = async (playlistId, userId) => {
  await getOwnedPlaylist(playlistId, userId);
  await playlistModel.remove(playlistId);
};

const addSongToPlaylist = async (playlistId, userId, songId) => {
  await getOwnedPlaylist(playlistId, userId);

  const song = await songModel.findById(songId);
  if (!song || !song.is_published) {
    throw new AppError("Song not found.", 404);
  }

  const alreadyIn = await playlistModel.findMembership(playlistId, songId);
  if (alreadyIn) {
    throw new AppError("This song is already in the playlist.", 409);
  }

  await withTransaction(async (client) => {
    await playlistModel.lockById(playlistId, client);
    const added = await playlistModel.addSong(playlistId, songId, client);
    if (!added) {
      throw new AppError("This song is already in the playlist.", 409);
    }
    await playlistModel.touchUpdatedAt(playlistId, client);
  });

  return getPlaylistDetail(playlistId, userId);
};

const removeSongFromPlaylist = async (playlistId, userId, songId) => {
  await getOwnedPlaylist(playlistId, userId);

  await withTransaction(async (client) => {
    await playlistModel.lockById(playlistId, client);
    await playlistModel.removeSong(playlistId, songId, client);
    await playlistModel.touchUpdatedAt(playlistId, client);
  });

  return getPlaylistDetail(playlistId, userId);
};

const reorderPlaylist = async (playlistId, userId, songIds) => {
  await getOwnedPlaylist(playlistId, userId);

  await withTransaction(async (client) => {
    await playlistModel.lockById(playlistId, client);
    const currentIds = (await playlistModel.findSongIds(playlistId, client)).map(String);

    const requested = new Set(songIds);
    const current = new Set(currentIds);
    const exactMatch =
      requested.size === current.size && currentIds.length === songIds.length &&
      currentIds.every((id) => requested.has(id));

    if (!exactMatch) {
      throw new AppError("Reorder must include exactly the playlist's current songs, each exactly once.", 400);
    }

    await playlistModel.reorderSongs(playlistId, songIds, client);
    await playlistModel.touchUpdatedAt(playlistId, client);
  });

  return getPlaylistDetail(playlistId, userId);
};

module.exports = {
  listPlaylists,
  getPlaylistDetail,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylist,
};
