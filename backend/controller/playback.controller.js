const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const playbackService = require("../service/playback.service");
const { validateSongIdInput, validateProgressInput } = require("../validation/playback.validation");

const createSession = asyncHandler(async (req, res) => {
  const { errors, values } = validateSongIdInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const session = await playbackService.startSession(req.user.id, values.songId);
  return sendSuccess(res, { statusCode: 201, message: "Playback session started.", data: session });
});

const progress = asyncHandler(async (req, res) => {
  const { errors, values } = validateProgressInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const result = await playbackService.recordProgress(req.user.id, req.params.sessionToken, values);
  return sendSuccess(res, { message: "Progress recorded.", data: result });
});

const end = asyncHandler(async (req, res) => {
  const { errors, values } = validateProgressInput(req.body);
  if (errors.length > 0) throw new AppError("Please fix the highlighted fields.", 400, errors);

  const result = await playbackService.endSession(req.user.id, req.params.sessionToken, values);
  return sendSuccess(res, { message: "Playback session ended.", data: result });
});

module.exports = { createSession, progress, end };
