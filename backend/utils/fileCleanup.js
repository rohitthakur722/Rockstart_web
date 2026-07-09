const fs = require("fs/promises");
const { resolveManagedFilePath, extractManagedFilename } = require("./mediaFiles");

const deleteFileQuietly = async (absolutePath) => {
  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[fileCleanup] Failed to remove file:", err.message);
    }
  }
};

const deleteUploadedFile = async (file) => {
  if (!file?.path) return;
  await deleteFileQuietly(file.path);
};

// Multer's `.fields()` upload puts files in an object keyed by field name,
// each value an array (e.g. { audio: [file], cover: [file] }).
const deleteUploadedFiles = async (filesByField) => {
  if (!filesByField) return;
  const files = Object.values(filesByField).flat();
  await Promise.all(files.map((file) => deleteFileQuietly(file.path)));
};

const deleteManagedFile = async (kind, urlOrPath) => {
  const filename = extractManagedFilename(kind, urlOrPath);
  if (!filename) return;

  const resolvedPath = resolveManagedFilePath(kind, filename);
  if (!resolvedPath) return;

  await deleteFileQuietly(resolvedPath);
};

const deleteManagedAvatar = (avatarUrl) => deleteManagedFile("profiles", avatarUrl);
const deleteManagedMusicFile = (audioUrl) => deleteManagedFile("music", audioUrl);
const deleteManagedCover = (coverUrl) => deleteManagedFile("covers", coverUrl);

module.exports = {
  deleteUploadedFile,
  deleteUploadedFiles,
  deleteManagedAvatar,
  deleteManagedMusicFile,
  deleteManagedCover,
};
