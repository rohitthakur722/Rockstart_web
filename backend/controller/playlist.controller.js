const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const playlistService = require("../service/playlist.service");
const {
  validatePlaylistCreateInput,
  validatePlaylistUpdateInput,
  validateAddSongInput,
  validateReorderInput,
} = require("../validation/playlist.validation");

const list = asyncHandler(async (req, res) => {
  const playlists = await playlistService.listPlaylists(req.user.id);
  return sendSuccess(res, { message: "Playlists retrieved.", data: { playlists } });
});

const create = asyncHandler(async (req, res) => {
  const { errors, values } = validatePlaylistCreateInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const playlist = await playlistService.createPlaylist(req.user.id, values);
  return sendSuccess(res, { statusCode: 201, message: "Playlist created.", data: { playlist } });
});

const getOne = asyncHandler(async (req, res) => {
  const playlist = await playlistService.getPlaylistDetail(req.params.playlistId, req.user.id);
  return sendSuccess(res, { message: "Playlist retrieved.", data: { playlist } });
});

const update = asyncHandler(async (req, res) => {
  const { errors, values } = validatePlaylistUpdateInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const playlist = await playlistService.updatePlaylist(req.params.playlistId, req.user.id, values);
  return sendSuccess(res, { message: "Playlist updated.", data: { playlist } });
});

const remove = asyncHandler(async (req, res) => {
  await playlistService.deletePlaylist(req.params.playlistId, req.user.id);
  return sendSuccess(res, { message: "Playlist deleted." });
});

const addSong = asyncHandler(async (req, res) => {
  const { errors, values } = validateAddSongInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const playlist = await playlistService.addSongToPlaylist(req.params.playlistId, req.user.id, values.songId);
  return sendSuccess(res, { statusCode: 201, message: "Song added to playlist.", data: { playlist } });
});

const removeSong = asyncHandler(async (req, res) => {
  const playlist = await playlistService.removeSongFromPlaylist(req.params.playlistId, req.user.id, req.params.songId);
  return sendSuccess(res, { message: "Song removed from playlist.", data: { playlist } });
});

const reorder = asyncHandler(async (req, res) => {
  const { errors, values } = validateReorderInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const playlist = await playlistService.reorderPlaylist(req.params.playlistId, req.user.id, values.songIds);
  return sendSuccess(res, { message: "Playlist reordered.", data: { playlist } });
});

module.exports = { list, create, getOne, update, remove, addSong, removeSong, reorder };
