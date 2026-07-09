const genreModel = require("../model/genre.model");
const AppError = require("../utils/AppError");
const { mapGenre } = require("../utils/catalogMapper");

const listGenres = async () => {
  const rows = await genreModel.findAllWithPublishedCounts();
  return rows.map((row) => ({ ...mapGenre(row), songCount: Number(row.song_count) }));
};

const createGenre = async ({ name }) => {
  const existing = await genreModel.findByNameCI(name);
  if (existing) {
    throw new AppError("A genre with that name already exists.", 409, [
      { field: "name", message: "A genre with that name already exists." },
    ]);
  }
  const genre = await genreModel.create({ name });
  return mapGenre(genre);
};

const updateGenre = async (genreId, { name }) => {
  const existing = await genreModel.findByNameCI(name);
  if (existing && String(existing.id) !== String(genreId)) {
    throw new AppError("A genre with that name already exists.", 409, [
      { field: "name", message: "A genre with that name already exists." },
    ]);
  }

  const genre = await genreModel.update(genreId, { name });
  if (!genre) throw new AppError("Genre not found.", 404);
  return mapGenre(genre);
};

const deleteGenre = async (genreId) => {
  const genre = await genreModel.findById(genreId);
  if (!genre) throw new AppError("Genre not found.", 404);

  const usageCount = await genreModel.countSongsUsingGenre(genreId);
  if (usageCount > 0) {
    throw new AppError("This genre is still assigned to songs. Remove it from those songs before deleting.", 409);
  }

  await genreModel.remove(genreId);
};

module.exports = { listGenres, createGenre, updateGenre, deleteGenre };
