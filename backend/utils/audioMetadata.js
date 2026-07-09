const AppError = require("./AppError");

// music-metadata is ESM-only; the rest of the backend stays CommonJS, so we
// load it lazily through dynamic import() rather than converting the project.
let parseFileFn = null;

const loadParser = async () => {
  if (!parseFileFn) {
    const mm = await import("music-metadata");
    parseFileFn = mm.parseFile;
  }
  return parseFileFn;
};

// Reads only the file's headers/frames needed to determine duration and
// format — music-metadata streams the file rather than loading it whole.
const extractAudioMetadata = async (filePath) => {
  const parseFile = await loadParser();

  let metadata;
  try {
    metadata = await parseFile(filePath, { duration: true });
  } catch {
    throw new AppError("The uploaded audio file could not be read.", 400);
  }

  const duration = metadata.format?.duration;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new AppError("The uploaded audio file could not be read.", 400);
  }

  return {
    durationSeconds: Math.round(duration),
    format: metadata.format?.container || metadata.format?.codec || null,
    embedded: {
      title: metadata.common?.title || null,
      artist: metadata.common?.artist || null,
      album: metadata.common?.album || null,
      trackNumber: metadata.common?.track?.no ?? null,
      releaseYear: metadata.common?.year ?? null,
    },
  };
};

module.exports = { extractAudioMetadata };
