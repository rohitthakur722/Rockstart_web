const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const likeService = require("../service/like.service");

const list = asyncHandler(async (req, res) => {
  const result = await likeService.listLiked(req.user.id, req.query);
  return sendSuccess(res, { message: "Liked songs retrieved.", data: result });
});

const listIds = asyncHandler(async (req, res) => {
  const songIds = await likeService.listLikedIds(req.user.id);
  return sendSuccess(res, { message: "Liked song IDs retrieved.", data: { songIds } });
});

const like = asyncHandler(async (req, res) => {
  const result = await likeService.likeSong(req.user.id, req.params.songId);
  return sendSuccess(res, { message: "Song liked.", data: result });
});

const unlike = asyncHandler(async (req, res) => {
  const result = await likeService.unlikeSong(req.user.id, req.params.songId);
  return sendSuccess(res, { message: "Song unliked.", data: result });
});

module.exports = { list, listIds, like, unlike };
