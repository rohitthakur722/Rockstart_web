const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const genreService = require("../service/genre.service");
const adminAuditService = require("../service/adminAudit.service");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const validateGenreInput = (body = {}) => {
  if (!isNonEmptyString(body.name)) {
    return { errors: [{ field: "name", message: "Genre name is required." }], values: {} };
  }
  const trimmed = body.name.trim();
  if (trimmed.length > 60) {
    return { errors: [{ field: "name", message: "Genre name must be at most 60 characters." }], values: {} };
  }
  return { errors: [], values: { name: trimmed } };
};

const list = asyncHandler(async (req, res) => {
  const genres = await genreService.listGenres();
  return sendSuccess(res, { message: "Genres retrieved.", data: { items: genres } });
});

const create = asyncHandler(async (req, res) => {
  const { errors, values } = validateGenreInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const genre = await genreService.createGenre(values);

  await adminAuditService.recordAction(req, {
    action: "genre_created",
    targetType: "genre",
    targetId: genre.id,
    metadata: { name: genre.name },
  });

  return sendSuccess(res, { statusCode: 201, message: "Genre created.", data: { genre } });
});

const update = asyncHandler(async (req, res) => {
  const { errors, values } = validateGenreInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const genre = await genreService.updateGenre(req.params.genreId, values);

  await adminAuditService.recordAction(req, {
    action: "genre_updated",
    targetType: "genre",
    targetId: req.params.genreId,
    metadata: { name: genre.name },
  });

  return sendSuccess(res, { message: "Genre updated.", data: { genre } });
});

const remove = asyncHandler(async (req, res) => {
  await genreService.deleteGenre(req.params.genreId);

  await adminAuditService.recordAction(req, {
    action: "genre_deleted",
    targetType: "genre",
    targetId: req.params.genreId,
  });

  return sendSuccess(res, { message: "Genre deleted." });
});

module.exports = { list, create, update, remove };
