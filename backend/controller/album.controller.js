const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const albumService = require("../service/album.service");
const adminAuditService = require("../service/adminAudit.service");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const validateAlbumCreateInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (!isNonEmptyString(body.artistId) || !/^\d+$/.test(String(body.artistId).trim())) {
    errors.push({ field: "artistId", message: "A valid artistId is required." });
  } else {
    values.artistId = String(body.artistId).trim();
  }

  if (!isNonEmptyString(body.title)) {
    errors.push({ field: "title", message: "Album title is required." });
  } else if (body.title.trim().length > 200) {
    errors.push({ field: "title", message: "Album title must be at most 200 characters." });
  } else {
    values.title = body.title.trim();
  }

  values.coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() || null : null;
  values.releaseDate = typeof body.releaseDate === "string" && body.releaseDate.trim() ? body.releaseDate.trim() : null;

  return { errors, values };
};

const validateAlbumUpdateInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) errors.push({ field: "title", message: "Album title cannot be blank." });
    else values.title = body.title.trim();
  }
  if (body.coverUrl !== undefined) values.coverUrl = body.coverUrl || null;
  if (body.releaseDate !== undefined) values.releaseDate = body.releaseDate || null;

  if (Object.keys(values).length === 0 && errors.length === 0) {
    errors.push({ field: "_", message: "Provide at least one field to update." });
  }

  return { errors, values };
};

const list = asyncHandler(async (req, res) => {
  const result = await albumService.listAlbums(req.query);
  return sendSuccess(res, { message: "Albums retrieved.", data: result });
});

const getDetail = asyncHandler(async (req, res) => {
  const album = await albumService.getAlbumDetail(req.params.albumId);
  return sendSuccess(res, { message: "Album retrieved.", data: { album } });
});

const create = asyncHandler(async (req, res) => {
  const { errors, values } = validateAlbumCreateInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const album = await albumService.createAlbum(values);

  await adminAuditService.recordAction(req, {
    action: "album_created",
    targetType: "album",
    targetId: album.id,
    metadata: { title: album.title },
  });

  return sendSuccess(res, { statusCode: 201, message: "Album created.", data: { album } });
});

const update = asyncHandler(async (req, res) => {
  const { errors, values } = validateAlbumUpdateInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const album = await albumService.updateAlbum(req.params.albumId, values);

  await adminAuditService.recordAction(req, {
    action: "album_updated",
    targetType: "album",
    targetId: req.params.albumId,
    metadata: { title: album.title },
  });

  return sendSuccess(res, { message: "Album updated.", data: { album } });
});

const remove = asyncHandler(async (req, res) => {
  await albumService.deleteAlbum(req.params.albumId);

  await adminAuditService.recordAction(req, {
    action: "album_deleted",
    targetType: "album",
    targetId: req.params.albumId,
  });

  return sendSuccess(res, { message: "Album deleted." });
});

module.exports = { list, getDetail, create, update, remove };
