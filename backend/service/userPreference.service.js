const userPreferenceModel = require("../model/userPreference.model");
const AppError = require("../utils/AppError");

const VALID_THEMES = new Set(["system", "dark", "light"]);

// Maps each accepted API field to its column + a validator; anything not in
// this map is an unknown field and rejected outright, never silently ignored.
const FIELD_MAP = {
  theme: {
    column: "theme_preference",
    validate: (value) => (VALID_THEMES.has(value) ? { value } : { error: "theme must be \"system\", \"dark\", or \"light\"." }),
  },
  reduceMotion: { column: "reduce_motion", validate: booleanField("reduceMotion") },
  compactLayout: { column: "compact_layout", validate: booleanField("compactLayout") },
  autoplayNext: { column: "autoplay_next", validate: booleanField("autoplayNext") },
  rememberPlayerState: { column: "remember_player_state", validate: booleanField("rememberPlayerState") },
  keyboardShortcutsEnabled: { column: "keyboard_shortcuts_enabled", validate: booleanField("keyboardShortcutsEnabled") },
};

function booleanField(name) {
  return (value) => (typeof value === "boolean" ? { value } : { error: `${name} must be true or false.` });
}

const getPreferences = async (userId) => {
  const existing = await userPreferenceModel.findByUserId(userId);
  if (existing) return existing;
  return userPreferenceModel.createDefault(userId);
};

const updatePreferences = async (userId, body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Please fix the highlighted fields.", 400, [
      { field: "_", message: "Request body must be an object." },
    ]);
  }

  const requestedFields = Object.keys(body);
  if (requestedFields.length === 0) {
    throw new AppError("Provide at least one preference to update.", 400);
  }

  const errors = [];
  const columnUpdates = {};

  for (const field of requestedFields) {
    const mapping = FIELD_MAP[field];
    if (!mapping) {
      errors.push({ field, message: `Unknown preference field "${field}".` });
      continue;
    }
    const { value, error } = mapping.validate(body[field]);
    if (error) {
      errors.push({ field, message: error });
      continue;
    }
    columnUpdates[mapping.column] = value;
  }

  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  // Ensure the row exists before a partial UPDATE (which would otherwise
  // silently affect zero rows for a first-time user).
  await getPreferences(userId);
  return userPreferenceModel.applyUpdate(userId, columnUpdates);
};

module.exports = { getPreferences, updatePreferences };
