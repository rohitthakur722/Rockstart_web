// file-type is ESM-only; loaded lazily via dynamic import() so the rest of
// the backend can stay CommonJS.
let fileTypeFromFileFn = null;

const loadDetector = async () => {
  if (!fileTypeFromFileFn) {
    const ft = await import("file-type");
    fileTypeFromFileFn = ft.fileTypeFromFile;
  }
  return fileTypeFromFileFn;
};

// Returns { ext, mime } detected from the file's actual byte signature, or
// null when the format can't be determined from magic bytes alone (some
// valid audio containers, like plain MP3 with no ID3 header, may not have a
// reliable signature — callers should treat null as "fall back to other
// validation layers", not as an automatic rejection).
const detectFileSignature = async (filePath) => {
  const fileTypeFromFile = await loadDetector();
  const result = await fileTypeFromFile(filePath);
  return result || null;
};

module.exports = { detectFileSignature };
