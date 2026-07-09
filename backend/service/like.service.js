const likeModel = require("../model/like.model");
const songModel = require("../model/song.model");
const AppError = require("../utils/AppError");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { parseSongListQuery } = require("../validation/catalog.validation");
const { mapSong } = require("../utils/catalogMapper");

const mapLikedSong = (row, viewer) => ({
  ...mapSong(row, { viewer }),
  likedAt: row.liked_at,
  liked: true,
});

const listLiked = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);
  const filters = parseSongListQuery(query, likeModel.SORT_COLUMNS, "likedAt");

  const listArgs = { userId, search: filters.search, sort: filters.sort, order: filters.order };

  const [rows, totalItems] = await Promise.all([
    likeModel.findList({ ...listArgs, limit, offset }),
    likeModel.countList(listArgs),
  ]);

  return {
    items: rows.map((row) => mapLikedSong(row, { id: userId, role: "user" })),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const listLikedIds = async (userId) => {
  const ids = await likeModel.findLikedIds(userId);
  return ids.map(String);
};

const likeSong = async (userId, songId) => {
  const song = await songModel.findById(songId);
  if (!song || !song.is_published) {
    throw new AppError("Song not found.", 404);
  }

  await likeModel.like(userId, songId);
  return { songId: String(songId), liked: true };
};

const unlikeSong = async (userId, songId) => {
  await likeModel.unlike(userId, songId);
  return { songId: String(songId), liked: false };
};

module.exports = { listLiked, listLikedIds, likeSong, unlikeSong };
