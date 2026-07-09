const songModel = require("../model/song.model");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { parseSongListQuery } = require("../validation/catalog.validation");
const { mapSong } = require("../utils/catalogMapper");

const VALID_STATUSES = new Set(["all", "draft", "published"]);
const ADMIN_VIEWER = { id: null, role: "admin" };

// Cross-user song listing for moderation — status/search/uploader filters,
// reusing the same sort/search sanitization the public catalog uses.
const listSongs = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const filters = parseSongListQuery(query, songModel.SORT_COLUMNS, "createdAt");
  const status = VALID_STATUSES.has(query.status) ? query.status : "all";
  const uploaderId = /^\d+$/.test(String(query.uploaderId || "")) ? query.uploaderId : null;

  const listArgs = { status, uploaderId, search: filters.search, sort: filters.sort, order: filters.order };

  const [rows, totalItems] = await Promise.all([
    songModel.findAdminList({ ...listArgs, limit, offset }),
    songModel.countAdminList(listArgs),
  ]);

  return {
    items: rows.map((row) => mapSong(row, { viewer: ADMIN_VIEWER })),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

module.exports = { listSongs };
