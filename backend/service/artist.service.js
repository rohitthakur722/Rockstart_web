const artistModel = require("../model/artist.model");
const albumModel = require("../model/album.model");
const songModel = require("../model/song.model");
const AppError = require("../utils/AppError");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { resolveSortAndOrder, sanitizeSearch } = require("../validation/catalog.validation");
const { mapArtistSummary, mapArtistDetail, mapAlbumSummary, mapSong } = require("../utils/catalogMapper");

const ARTIST_SORT_COLUMNS = { name: true, albumCount: true, songCount: true, createdAt: true };

const listArtists = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { sort, order } = resolveSortAndOrder(query, ARTIST_SORT_COLUMNS, "name");
  const search = sanitizeSearch(query.search);

  const [rows, totalItems] = await Promise.all([
    artistModel.findPublicList({ search, sort, order, limit, offset }),
    artistModel.countPublicList({ search }),
  ]);

  return {
    items: rows.map(mapArtistSummary),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const getArtistDetail = async (artistId) => {
  const artist = await artistModel.findById(artistId);
  if (!artist) throw new AppError("Artist not found.", 404);

  const [albums, songs] = await Promise.all([
    albumModel.findPublicList({ artistId, sort: "createdAt", order: "DESC", limit: 100, offset: 0 }),
    songModel.findPublishedByArtist(artistId),
  ]);

  return mapArtistDetail(artist, {
    albums: albums.map(mapAlbumSummary),
    songs: songs.map((row) => mapSong(row)),
  });
};

const createArtist = async ({ name, bio, imageUrl }) => {
  const existing = await artistModel.findByNameCI(name);
  if (existing) {
    throw new AppError("An artist with that name already exists.", 409, [
      { field: "name", message: "An artist with that name already exists." },
    ]);
  }
  const artist = await artistModel.create({ name, bio, imageUrl });
  return mapArtistDetail(artist, { albums: [], songs: [] });
};

const updateArtist = async (artistId, updates) => {
  if (updates.name) {
    const existing = await artistModel.findByNameCI(updates.name);
    if (existing && String(existing.id) !== String(artistId)) {
      throw new AppError("An artist with that name already exists.", 409, [
        { field: "name", message: "An artist with that name already exists." },
      ]);
    }
  }

  const artist = await artistModel.update(artistId, updates);
  if (!artist) throw new AppError("Artist not found.", 404);
  return getArtistDetail(artistId);
};

const deleteArtist = async (artistId) => {
  const artist = await artistModel.findById(artistId);
  if (!artist) throw new AppError("Artist not found.", 404);

  const [albumCount, songCount] = await Promise.all([
    artistModel.countAlbums(artistId),
    artistModel.countSongs(artistId),
  ]);

  if (albumCount > 0 || songCount > 0) {
    throw new AppError(
      "This artist still has albums or songs. Remove or reassign them before deleting the artist.",
      409
    );
  }

  await artistModel.remove(artistId);
};

module.exports = { listArtists, getArtistDetail, createArtist, updateArtist, deleteArtist };
