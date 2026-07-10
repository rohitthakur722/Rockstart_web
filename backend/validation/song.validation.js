const CURRENT_YEAR_CEILING = 2100;
const MIN_RELEASE_YEAR = 1900;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const parseGenreIds = (raw) => {
  if (raw === undefined || raw === null || raw === "") return { value: [] };

  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return { error: "Genres must be a JSON array of genre IDs." };
    }
  }

  if (!Array.isArray(list)) {
    return { error: "Genres must be a JSON array of genre IDs." };
  }

  const ids = [];
  for (const item of list) {
    const id = String(item).trim();
    if (!/^\d+$/.test(id)) {
      return { error: "Genre IDs must be positive integers." };
    }
    if (!ids.includes(id)) ids.push(id);
  }

  return { value: ids };
};

const validateTitle = (value) => {
  if (value === undefined) return { value: undefined };
  if (!isNonEmptyString(value)) return { error: "Title cannot be blank." };
  const trimmed = value.trim();
  if (trimmed.length > 200) return { error: "Title must be at most 200 characters." };
  return { value: trimmed };
};

const validateArtistName = (value, { required }) => {
  if (value === undefined) {
    return required ? { error: "Artist name is required." } : { value: undefined };
  }
  if (!isNonEmptyString(value)) return { error: "Artist name cannot be blank." };
  const trimmed = value.trim();
  if (trimmed.length > 150) return { error: "Artist name must be at most 150 characters." };
  return { value: trimmed };
};

const validateAlbumTitle = (value) => {
  if (value === undefined || value === null || value === "") return { value: null };
  if (!isNonEmptyString(value)) return { error: "Album title cannot be blank." };
  const trimmed = value.trim();
  if (trimmed.length > 200) return { error: "Album title must be at most 200 characters." };
  return { value: trimmed };
};

const validateTrackNumber = (value) => {
  if (value === undefined || value === null || value === "") return { value: null };
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) return { error: "Track number must be a non-negative integer." };
  return { value: num };
};

const validateReleaseYear = (value) => {
  if (value === undefined || value === null || value === "") return { value: null };
  const num = Number(value);
  if (!Number.isInteger(num) || num < MIN_RELEASE_YEAR || num > CURRENT_YEAR_CEILING) {
    return { error: `Release year must be between ${MIN_RELEASE_YEAR} and ${CURRENT_YEAR_CEILING}.` };
  }
  return { value: num };
};

const validateSongCreateInput = (body = {}) => {
  const errors = [];
  const values = {};

  const title = validateTitle(body.title);
  if (title.error) errors.push({ field: "title", message: title.error });
  else values.title = title.value ?? null;

  const artistName = validateArtistName(body.artistName, { required: true });
  if (artistName.error) errors.push({ field: "artistName", message: artistName.error });
  else values.artistName = artistName.value;

  const albumTitle = validateAlbumTitle(body.albumTitle);
  if (albumTitle.error) errors.push({ field: "albumTitle", message: albumTitle.error });
  else values.albumTitle = albumTitle.value;

  const genreIds = parseGenreIds(body.genreIds);
  if (genreIds.error) errors.push({ field: "genreIds", message: genreIds.error });
  else values.genreIds = genreIds.value;

  const trackNumber = validateTrackNumber(body.trackNumber);
  if (trackNumber.error) errors.push({ field: "trackNumber", message: trackNumber.error });
  else values.trackNumber = trackNumber.value;

  const releaseYear = validateReleaseYear(body.releaseYear);
  if (releaseYear.error) errors.push({ field: "releaseYear", message: releaseYear.error });
  else values.releaseYear = releaseYear.value;

  return { errors, values };
};

// Device-import mode (POST /api/songs/import) never requires title or
// artistName — song.service.js's importSong falls back to the filename and
// "Unknown Artist" — but still enforces the same length/format constraints
// on whatever was actually supplied. This must never be relaxed for the
// normal manual-upload path (validateSongCreateInput, above).
const validateSongImportInput = (body = {}) => {
  const errors = [];
  const values = {};

  const title = validateTitle(body.title);
  if (title.error) errors.push({ field: "title", message: title.error });
  else values.title = title.value ?? null;

  const artistName = validateArtistName(body.artistName, { required: false });
  if (artistName.error) errors.push({ field: "artistName", message: artistName.error });
  else values.artistName = artistName.value ?? null;

  const albumTitle = validateAlbumTitle(body.albumTitle);
  if (albumTitle.error) errors.push({ field: "albumTitle", message: albumTitle.error });
  else values.albumTitle = albumTitle.value;

  const genreIds = parseGenreIds(body.genreIds);
  if (genreIds.error) errors.push({ field: "genreIds", message: genreIds.error });
  else values.genreIds = genreIds.value;

  const trackNumber = validateTrackNumber(body.trackNumber);
  if (trackNumber.error) errors.push({ field: "trackNumber", message: trackNumber.error });
  else values.trackNumber = trackNumber.value;

  const releaseYear = validateReleaseYear(body.releaseYear);
  if (releaseYear.error) errors.push({ field: "releaseYear", message: releaseYear.error });
  else values.releaseYear = releaseYear.value;

  return { errors, values };
};

const UPDATABLE_FIELDS = ["title", "artistName", "albumTitle", "genreIds", "trackNumber", "releaseYear"];

const validateSongUpdateInput = (body = {}) => {
  const errors = [];
  const values = {};

  const presentFields = UPDATABLE_FIELDS.filter((field) => body[field] !== undefined);
  if (presentFields.length === 0) {
    errors.push({ field: "_", message: "Provide at least one field to update." });
    return { errors, values };
  }

  if (body.title !== undefined) {
    const title = validateTitle(body.title);
    if (title.error) errors.push({ field: "title", message: title.error });
    else values.title = title.value;
  }

  if (body.artistName !== undefined) {
    const artistName = validateArtistName(body.artistName, { required: true });
    if (artistName.error) errors.push({ field: "artistName", message: artistName.error });
    else values.artistName = artistName.value;
  }

  if (body.albumTitle !== undefined) {
    const albumTitle = validateAlbumTitle(body.albumTitle);
    if (albumTitle.error) errors.push({ field: "albumTitle", message: albumTitle.error });
    else values.albumTitle = albumTitle.value;
  }

  if (body.genreIds !== undefined) {
    const genreIds = parseGenreIds(body.genreIds);
    if (genreIds.error) errors.push({ field: "genreIds", message: genreIds.error });
    else values.genreIds = genreIds.value;
  }

  if (body.trackNumber !== undefined) {
    const trackNumber = validateTrackNumber(body.trackNumber);
    if (trackNumber.error) errors.push({ field: "trackNumber", message: trackNumber.error });
    else values.trackNumber = trackNumber.value;
  }

  if (body.releaseYear !== undefined) {
    const releaseYear = validateReleaseYear(body.releaseYear);
    if (releaseYear.error) errors.push({ field: "releaseYear", message: releaseYear.error });
    else values.releaseYear = releaseYear.value;
  }

  return { errors, values };
};

const validatePublicationInput = (body = {}) => {
  if (typeof body.isPublished !== "boolean") {
    return { errors: [{ field: "isPublished", message: "isPublished must be true or false." }], values: {} };
  }
  return { errors: [], values: { isPublished: body.isPublished } };
};

module.exports = {
  validateSongCreateInput,
  validateSongImportInput,
  validateSongUpdateInput,
  validatePublicationInput,
};
