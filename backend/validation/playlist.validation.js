const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_REORDER_SONGS = 2000;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const validateName = (value) => {
  if (!isNonEmptyString(value)) return { error: "Playlist name cannot be blank." };
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { error: `Playlist name must be at most ${MAX_NAME_LENGTH} characters.` };
  }
  return { value: trimmed };
};

const validateDescription = (value) => {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "Description must be text." };
  const trimmed = value.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.` };
  }
  return { value: trimmed };
};

const validateSongId = (value) => {
  if (value === undefined || value === null || value === "") return { error: "A song ID is required." };
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) return { error: "Song ID must be a positive integer." };
  return { value: id };
};

const validatePlaylistCreateInput = (body = {}) => {
  const errors = [];
  const values = {};

  const name = validateName(body.name);
  if (name.error) errors.push({ field: "name", message: name.error });
  else values.name = name.value;

  const description = validateDescription(body.description);
  if (description.error) errors.push({ field: "description", message: description.error });
  else values.description = description.value;

  return { errors, values };
};

const validatePlaylistUpdateInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (body.name === undefined && body.description === undefined) {
    errors.push({ field: "_", message: "Provide at least one field to update." });
    return { errors, values };
  }

  if (body.name !== undefined) {
    const name = validateName(body.name);
    if (name.error) errors.push({ field: "name", message: name.error });
    else values.name = name.value;
  }

  if (body.description !== undefined) {
    const description = validateDescription(body.description);
    if (description.error) errors.push({ field: "description", message: description.error });
    else values.description = description.value;
  }

  return { errors, values };
};

const validateAddSongInput = (body = {}) => {
  const errors = [];
  const values = {};

  const songId = validateSongId(body.songId);
  if (songId.error) errors.push({ field: "songId", message: songId.error });
  else values.songId = songId.value;

  return { errors, values };
};

const validateReorderInput = (body = {}) => {
  const errors = [];

  if (!Array.isArray(body.songIds) || body.songIds.length === 0) {
    errors.push({ field: "songIds", message: "songIds must be a non-empty array." });
    return { errors, values: {} };
  }

  if (body.songIds.length > MAX_REORDER_SONGS) {
    errors.push({ field: "songIds", message: `A playlist cannot be reordered with more than ${MAX_REORDER_SONGS} songs at once.` });
    return { errors, values: {} };
  }

  const songIds = [];
  const seen = new Set();
  for (const raw of body.songIds) {
    const id = String(raw).trim();
    if (!/^\d+$/.test(id)) {
      errors.push({ field: "songIds", message: "Every song ID must be a positive integer." });
      return { errors, values: {} };
    }
    if (seen.has(id)) {
      errors.push({ field: "songIds", message: "songIds must not contain duplicates." });
      return { errors, values: {} };
    }
    seen.add(id);
    songIds.push(id);
  }

  return { errors, values: { songIds } };
};

module.exports = {
  validatePlaylistCreateInput,
  validatePlaylistUpdateInput,
  validateAddSongInput,
  validateReorderInput,
};
