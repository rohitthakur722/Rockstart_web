const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const adminCatalogService = require("../service/adminCatalog.service");
const songService = require("../service/song.service");
const adminAuditService = require("../service/adminAudit.service");
const { validatePublicationInput } = require("../validation/song.validation");

const listSongs = asyncHandler(async (req, res) => {
  const result = await adminCatalogService.listSongs(req.query);
  return sendSuccess(res, { message: "Songs retrieved.", data: result });
});

const getSongDetail = asyncHandler(async (req, res) => {
  // Reuses the existing owner/admin song service — no moderation-specific
  // detail logic to duplicate.
  const song = await songService.getSongDetail(req.params.songId, { id: req.user.id, role: "admin" });
  return sendSuccess(res, { message: "Song retrieved.", data: { song } });
});

const setPublication = asyncHandler(async (req, res) => {
  const { errors, values } = validatePublicationInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const song = await songService.setPublication(req.params.songId, values.isPublished);

  await adminAuditService.recordAction(req, {
    action: values.isPublished ? "song_published" : "song_unpublished",
    targetType: "song",
    targetId: req.params.songId,
    metadata: { title: song.title },
  });

  return sendSuccess(res, { message: "Publication status updated.", data: { song } });
});

const removeSong = asyncHandler(async (req, res) => {
  const song = await songService.getSongDetail(req.params.songId, { id: req.user.id, role: "admin" });
  await songService.deleteSong(req.params.songId, { id: req.user.id, role: "admin" });

  await adminAuditService.recordAction(req, {
    action: "song_deleted_by_admin",
    targetType: "song",
    targetId: req.params.songId,
    metadata: { title: song.title, uploadedBy: song.uploadedBy ?? null },
  });

  return sendSuccess(res, { message: "Song deleted." });
});

module.exports = { listSongs, getSongDetail, setPublication, removeSong };
