const albumModel = require("../model/album.model");
const artistModel = require("../model/artist.model");
const songModel = require("../model/song.model");
const AppError = require("../utils/AppError");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { resolveSortAndOrder, sanitizeSearch, sanitizeIdFilter, sanitizeYearFilter } = require("../validation/catalog.validation");
const { mapAlbumSummary, mapAlbumDetail, mapSong } = require("../utils/catalogMapper");

const ALBUM_SORT_COLUMNS = { title: true, artist: true, releaseYear: true, createdAt: true, songCount: true };

const listAlbums = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { sort, order } = resolveSortAndOrder(query, ALBUM_SORT_COLUMNS, "createdAt");
  const search = sanitizeSearch(query.search);
  const artistId = sanitizeIdFilter(query.artistId);
  const releaseYear = sanitizeYearFilter(query.releaseYear);

  const filters = { search, artistId, releaseYear };

  const [rows, totalItems] = await Promise.all([
    albumModel.findPublicList({ ...filters, sort, order, limit, offset }),
    albumModel.countPublicList(filters),
  ]);

  return {
    items: rows.map(mapAlbumSummary),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const getAlbumDetail = async (albumId) => {
  const album = await albumModel.findById(albumId);
  if (!album) throw new AppError("Album not found.", 404);

  const rows = await songModel.findPublishedByAlbum(albumId);
  const songs = rows.map((row) => mapSong(row));
  const totalDurationSeconds = rows.reduce((sum, row) => sum + (row.duration_seconds || 0), 0);

  return mapAlbumDetail(album, { songs, totalDurationSeconds });
};

const createAlbum = async ({ artistId, title, coverUrl, releaseDate }) => {
  const artist = await artistModel.findById(artistId);
  if (!artist) {
    throw new AppError("Selected artist does not exist.", 400, [{ field: "artistId", message: "Selected artist does not exist." }]);
  }

  const existing = await albumModel.findByArtistAndTitleCI(artistId, title);
  if (existing) {
    throw new AppError("This artist already has an album with that title.", 409, [
      { field: "title", message: "This artist already has an album with that title." },
    ]);
  }

  const album = await albumModel.create({ artistId, title, coverUrl, releaseDate });
  return getAlbumDetail(album.id);
};

const updateAlbum = async (albumId, updates) => {
  const album = await albumModel.findById(albumId);
  if (!album) throw new AppError("Album not found.", 404);

  if (updates.title) {
    const existing = await albumModel.findByArtistAndTitleCI(album.artist_id, updates.title);
    if (existing && String(existing.id) !== String(albumId)) {
      throw new AppError("This artist already has an album with that title.", 409, [
        { field: "title", message: "This artist already has an album with that title." },
      ]);
    }
  }

  await albumModel.update(albumId, updates);
  return getAlbumDetail(albumId);
};

const deleteAlbum = async (albumId) => {
  const album = await albumModel.findById(albumId);
  if (!album) throw new AppError("Album not found.", 404);

  // Songs keep their album_id set to NULL (see schema's ON DELETE SET NULL) —
  // deleting an album never deletes the songs or their audio files.
  await albumModel.remove(albumId);
};

module.exports = { listAlbums, getAlbumDetail, createAlbum, updateAlbum, deleteAlbum };
