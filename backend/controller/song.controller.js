const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const songService = require("../service/song.service");
const streamingService = require("../service/streaming.service");
const catalogService = require("../service/catalog.service");
const { deleteUploadedFiles } = require("../utils/fileCleanup");
const {
  validateSongCreateInput,
  validateSongImportInput,
  validateSongUpdateInput,
  validatePublicationInput,
} = require("../validation/song.validation");

const create = asyncHandler(async (req, res) => {
  const { errors, values } = validateSongCreateInput(req.body);
  if (errors.length > 0) {
    await deleteUploadedFiles(req.files);
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const song = await songService.createSong(req.user.id, values, req.files);
  return sendSuccess(res, { statusCode: 201, message: "Song uploaded.", data: { song } });
});

const importDeviceSong = asyncHandler(async (req, res) => {
  const { errors, values } = validateSongImportInput(req.body);
  if (errors.length > 0) {
    await deleteUploadedFiles(req.files);
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const { song, duplicate } = await songService.importSong(req.user.id, values, req.files);
  return sendSuccess(res, {
    statusCode: duplicate ? 200 : 201,
    message: duplicate ? "This song was already imported to your account." : "Song imported as a draft.",
    data: { song, duplicate },
  });
});

const listPublic = asyncHandler(async (req, res) => {
  const result = await catalogService.listSongs(req.query, req.user || null);
  return sendSuccess(res, { message: "Songs retrieved.", data: result });
});

const listMine = asyncHandler(async (req, res) => {
  const result = await catalogService.listMySongs(req.user.id, req.query);
  return sendSuccess(res, { message: "Your uploads retrieved.", data: result });
});

const getDetail = asyncHandler(async (req, res) => {
  const song = await songService.getSongDetail(req.params.songId, req.user || null);
  return sendSuccess(res, { message: "Song retrieved.", data: { song } });
});

const stream = asyncHandler(async (req, res) => {
  const song = await songService.getSongForStreaming(req.params.songId, req.user || null);
  await streamingService.serveAudioStream(req, res, song);
});

const update = asyncHandler(async (req, res) => {
  const { errors, values } = validateSongUpdateInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const song = await songService.updateSong(req.params.songId, req.user, values);
  return sendSuccess(res, { message: "Song updated.", data: { song } });
});

const replaceCover = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("A cover image is required.", 400);
  }

  const song = await songService.replaceCover(req.params.songId, req.user, req.file);
  return sendSuccess(res, { message: "Cover updated.", data: { song } });
});

const setPublication = asyncHandler(async (req, res) => {
  const { errors, values } = validatePublicationInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const song = await songService.setPublication(req.params.songId, values.isPublished);
  return sendSuccess(res, { message: "Publication status updated.", data: { song } });
});

const remove = asyncHandler(async (req, res) => {
  await songService.deleteSong(req.params.songId, req.user);
  return sendSuccess(res, { message: "Song deleted." });
});

module.exports = {
  create,
  importDeviceSong,
  listPublic,
  listMine,
  getDetail,
  stream,
  update,
  replaceCover,
  setPublication,
  remove,
};
