const songModel = require("../model/song.model");
const artistModel = require("../model/artist.model");
const albumModel = require("../model/album.model");
const genreModel = require("../model/genre.model");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { parseSongListQuery } = require("../validation/catalog.validation");
const {
  mapSong,
  mapArtistSummary,
  mapAlbumSummary,
  mapGenre,
} = require("../utils/catalogMapper");

const HOME_SECTION_LIMIT = 10;
const HOME_BROWSE_LIMIT = 8;

const listSongs = async (query, viewer) => {
  const { page, limit, offset } = parsePagination(query);
  const filters = parseSongListQuery(query, songModel.SORT_COLUMNS, "createdAt");

  const [rows, totalItems] = await Promise.all([
    songModel.findPublicList({ ...filters, limit, offset }),
    songModel.countPublicList(filters),
  ]);

  return {
    items: rows.map((row) => mapSong(row, { viewer })),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const VALID_STATUS_FILTERS = new Set(["all", "draft", "published"]);

const listMySongs = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);
  const filters = parseSongListQuery(query, songModel.SORT_COLUMNS, "createdAt");
  const status = VALID_STATUS_FILTERS.has(query.status) ? query.status : "all";

  const listArgs = { userId, status, search: filters.search, sort: filters.sort, order: filters.order };

  const [rows, totalItems] = await Promise.all([
    songModel.findMineList({ ...listArgs, limit, offset }),
    songModel.countMineList(listArgs),
  ]);

  return {
    items: rows.map((row) => mapSong(row, { viewer: { id: userId, role: "user" } })),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const getHomeCatalog = async () => {
  const [recentRows, popularRows, albumRows, artistRows, genreRows] = await Promise.all([
    songModel.findRecentlyAdded(HOME_SECTION_LIMIT),
    songModel.findPopular(HOME_SECTION_LIMIT),
    albumModel.findPublicList({ sort: "createdAt", order: "DESC", limit: HOME_BROWSE_LIMIT, offset: 0 }),
    artistModel.findPublicList({ sort: "createdAt", order: "DESC", limit: HOME_BROWSE_LIMIT, offset: 0 }),
    genreModel.findAllWithPublishedCounts(),
  ]);

  return {
    recentlyAdded: recentRows.map((row) => mapSong(row)),
    popular: popularRows.map((row) => mapSong(row)),
    albums: albumRows.map(mapAlbumSummary),
    artists: artistRows.filter((row) => Number(row.song_count) > 0).map(mapArtistSummary),
    genres: genreRows
      .filter((row) => Number(row.song_count) > 0)
      .slice(0, HOME_BROWSE_LIMIT)
      .map((row) => ({ ...mapGenre(row), songCount: Number(row.song_count) })),
  };
};

module.exports = { listSongs, listMySongs, getHomeCatalog };
