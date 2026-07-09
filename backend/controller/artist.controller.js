const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const artistService = require("../service/artist.service");
const adminAuditService = require("../service/adminAudit.service");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const validateArtistInput = (body = {}, { partial = false } = {}) => {
  const errors = [];
  const values = {};

  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      errors.push({ field: "name", message: "Artist name is required." });
    } else if (body.name.trim().length > 150) {
      errors.push({ field: "name", message: "Artist name must be at most 150 characters." });
    } else {
      values.name = body.name.trim();
    }
  }

  if (body.bio !== undefined) values.bio = typeof body.bio === "string" ? body.bio.trim() || null : null;
  if (body.imageUrl !== undefined) values.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;

  return { errors, values };
};

const list = asyncHandler(async (req, res) => {
  const result = await artistService.listArtists(req.query);
  return sendSuccess(res, { message: "Artists retrieved.", data: result });
});

const getDetail = asyncHandler(async (req, res) => {
  const artist = await artistService.getArtistDetail(req.params.artistId);
  return sendSuccess(res, { message: "Artist retrieved.", data: { artist } });
});

const create = asyncHandler(async (req, res) => {
  const { errors, values } = validateArtistInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const artist = await artistService.createArtist(values);

  await adminAuditService.recordAction(req, {
    action: "artist_created",
    targetType: "artist",
    targetId: artist.id,
    metadata: { name: artist.name },
  });

  return sendSuccess(res, { statusCode: 201, message: "Artist created.", data: { artist } });
});

const update = asyncHandler(async (req, res) => {
  const { errors, values } = validateArtistInput(req.body, { partial: true });
  if (Object.keys(values).length === 0) {
    errors.push({ field: "_", message: "Provide at least one field to update." });
  }
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const artist = await artistService.updateArtist(req.params.artistId, values);

  await adminAuditService.recordAction(req, {
    action: "artist_updated",
    targetType: "artist",
    targetId: req.params.artistId,
    metadata: { name: artist.name },
  });

  return sendSuccess(res, { message: "Artist updated.", data: { artist } });
});

const remove = asyncHandler(async (req, res) => {
  await artistService.deleteArtist(req.params.artistId);

  await adminAuditService.recordAction(req, {
    action: "artist_deleted",
    targetType: "artist",
    targetId: req.params.artistId,
  });

  return sendSuccess(res, { message: "Artist deleted." });
});

module.exports = { list, getDetail, create, update, remove };
