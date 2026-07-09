const songModel = require("../model/song.model");
const artistModel = require("../model/artist.model");
const albumModel = require("../model/album.model");
const genreModel = require("../model/genre.model");
const { withTransaction } = require("../config/db");
const AppError = require("../utils/AppError");
const { mapSong } = require("../utils/catalogMapper");
const { extractAudioMetadata } = require("../utils/audioMetadata");
const { detectFileSignature } = require("../utils/fileSignature");
const { getImageMaxBytes } = require("../utils/uploadConfig");
const {
  deleteUploadedFiles,
  deleteUploadedFile,
  deleteManagedMusicFile,
  deleteManagedCover,
} = require("../utils/fileCleanup");

const ALLOWED_AUDIO_SIGNATURE_EXTS = new Set(["mp3", "wav", "m4a", "mp4", "ogg", "oga"]);
const ALLOWED_IMAGE_SIGNATURE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

const validateAudioSignature = async (filePath) => {
  const signature = await detectFileSignature(filePath);
  // A handful of valid MP3 files (no ID3 header) aren't reliably detected by
  // magic-byte sniffing; when undetectable we defer to metadata parsing,
  // which will itself fail on genuinely invalid audio.
  if (signature && !ALLOWED_AUDIO_SIGNATURE_EXTS.has(signature.ext?.toLowerCase())) {
    throw new AppError("The uploaded audio file could not be read.", 400);
  }
};

const validateImageSignature = async (filePath, label) => {
  const signature = await detectFileSignature(filePath);
  if (!signature || !ALLOWED_IMAGE_SIGNATURE_EXTS.has(signature.ext?.toLowerCase())) {
    throw new AppError(`${label} must be a genuine JPEG, PNG, or WebP image.`, 400);
  }
};

const resolveOrCreateArtist = async (name, client) => {
  const existing = await artistModel.findByNameCI(name, client);
  if (existing) return existing;

  try {
    return await artistModel.create({ name }, client);
  } catch (err) {
    if (err.code === "23505") {
      const raceWinner = await artistModel.findByNameCI(name, client);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

const resolveOrCreateAlbum = async (artistId, title, client) => {
  if (!title) return null;

  const existing = await albumModel.findByArtistAndTitleCI(artistId, title, client);
  if (existing) return existing;

  try {
    return await albumModel.create({ artistId, title }, client);
  } catch (err) {
    if (err.code === "23505") {
      const raceWinner = await albumModel.findByArtistAndTitleCI(artistId, title, client);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

const validateGenreIds = async (genreIds) => {
  if (!genreIds || genreIds.length === 0) return [];
  const found = await genreModel.findByIds(genreIds);
  if (found.length !== genreIds.length) {
    throw new AppError("One or more selected genres do not exist.", 400, [
      { field: "genreIds", message: "One or more selected genres do not exist." },
    ]);
  }
  return genreIds;
};

const createSong = async (userId, fields, files) => {
  const audioFile = files?.audio?.[0];
  const coverFile = files?.cover?.[0];

  if (!audioFile) {
    if (coverFile) await deleteUploadedFile(coverFile);
    throw new AppError("An audio file is required.", 400);
  }

  try {
    if (coverFile && coverFile.size > getImageMaxBytes()) {
      throw new AppError("The cover image exceeds the configured limit.", 400);
    }

    await validateAudioSignature(audioFile.path);
    if (coverFile) await validateImageSignature(coverFile.path, "Cover image");

    const metadata = await extractAudioMetadata(audioFile.path);

    const title = fields.title || metadata.embedded.title;
    if (!title) {
      throw new AppError("Title is required and could not be determined from the audio file.", 400, [
        { field: "title", message: "Title is required and could not be determined from the audio file." },
      ]);
    }

    const trackNumber = fields.trackNumber ?? metadata.embedded.trackNumber ?? null;
    const releaseYear = fields.releaseYear ?? metadata.embedded.releaseYear ?? null;

    await validateGenreIds(fields.genreIds);

    const audioUrl = `/uploads/music/${audioFile.filename}`;
    const coverUrl = coverFile ? `/uploads/covers/${coverFile.filename}` : null;

    const songId = await withTransaction(async (client) => {
      const artist = await resolveOrCreateArtist(fields.artistName, client);
      const album = await resolveOrCreateAlbum(artist.id, fields.albumTitle, client);

      const newSongId = await songModel.create(
        {
          title,
          artistId: artist.id,
          albumId: album?.id || null,
          uploadedBy: userId,
          audioUrl,
          coverUrl,
          durationSeconds: metadata.durationSeconds,
          mimeType: audioFile.mimetype,
          audioFormat: metadata.format,
          fileSize: audioFile.size,
          trackNumber,
          releaseYear,
        },
        client
      );

      await songModel.replaceGenres(newSongId, fields.genreIds, client);
      return newSongId;
    });

    const row = await songModel.findById(songId);
    return mapSong(row, { viewer: { id: userId, role: "user" } });
  } catch (err) {
    await deleteUploadedFiles(files);
    throw err;
  }
};

const assertCanViewSong = (row, viewer) => {
  if (row.is_published) return;
  const isOwner = viewer && String(viewer.id) === String(row.uploaded_by);
  const isAdmin = viewer?.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new AppError("Song not found.", 404);
  }
};

const assertCanModifySong = (row, viewer) => {
  const isOwner = viewer && String(viewer.id) === String(row.uploaded_by);
  const isAdmin = viewer?.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new AppError("You do not have permission to modify this song.", 403);
  }
};

const getSongDetail = async (songId, viewer) => {
  const row = await songModel.findById(songId);
  if (!row) throw new AppError("Song not found.", 404);
  assertCanViewSong(row, viewer);
  return mapSong(row, { viewer });
};

const getSongForStreaming = async (songId, viewer) => {
  const row = await songModel.findStreamInfoById(songId);
  if (!row) throw new AppError("Song not found.", 404);
  assertCanViewSong(row, viewer);
  return row;
};

const updateSong = async (songId, viewer, updates) => {
  const row = await songModel.findById(songId);
  if (!row) throw new AppError("Song not found.", 404);
  assertCanModifySong(row, viewer);

  let artistId = null;
  let albumId = row.album_id;

  await withTransaction(async (client) => {
    if (updates.artistName !== undefined) {
      const artist = await resolveOrCreateArtist(updates.artistName, client);
      artistId = artist.id;

      if (updates.albumTitle !== undefined) {
        const album = await resolveOrCreateAlbum(artistId, updates.albumTitle, client);
        albumId = album?.id || null;
      } else if (row.album_id) {
        // Artist changed but album wasn't explicitly updated — verify the
        // existing album still belongs to the (possibly new) artist.
        const currentAlbum = await albumModel.findById(row.album_id);
        if (currentAlbum && String(currentAlbum.artist_id) !== String(artistId)) {
          albumId = null;
        }
      }
    } else if (updates.albumTitle !== undefined) {
      const album = await resolveOrCreateAlbum(row.artist_id, updates.albumTitle, client);
      albumId = album?.id || null;
    }

    if (updates.genreIds !== undefined) {
      await validateGenreIds(updates.genreIds);
      await songModel.replaceGenres(songId, updates.genreIds, client);
    }

    await songModel.updateMetadata(
      songId,
      {
        title: updates.title,
        artistId,
        albumId,
        trackNumber: updates.trackNumber,
        releaseYear: updates.releaseYear,
      },
      client
    );
  });

  const updatedRow = await songModel.findById(songId);
  return mapSong(updatedRow, { viewer });
};

const replaceCover = async (songId, viewer, coverFile) => {
  if (!coverFile) throw new AppError("A cover image is required.", 400);

  const row = await songModel.findById(songId);
  if (!row) {
    await deleteUploadedFile(coverFile);
    throw new AppError("Song not found.", 404);
  }

  try {
    assertCanModifySong(row, viewer);
    await validateImageSignature(coverFile.path, "Cover image");

    const coverUrl = `/uploads/covers/${coverFile.filename}`;
    await songModel.updateCoverUrl(songId, coverUrl);
    await deleteManagedCover(row.cover_url);

    const updatedRow = await songModel.findById(songId);
    return mapSong(updatedRow, { viewer });
  } catch (err) {
    await deleteUploadedFile(coverFile);
    throw err;
  }
};

const deleteSong = async (songId, viewer) => {
  const row = await songModel.findById(songId);
  if (!row) throw new AppError("Song not found.", 404);
  assertCanModifySong(row, viewer);

  await songModel.remove(songId);
  await deleteManagedMusicFile(row.audio_url);
  await deleteManagedCover(row.cover_url);
};

const setPublication = async (songId, isPublished) => {
  const updated = await songModel.updatePublication(songId, isPublished);
  if (!updated) throw new AppError("Song not found.", 404);

  const row = await songModel.findById(songId);
  return mapSong(row, { viewer: { role: "admin" } });
};

module.exports = {
  createSong,
  getSongDetail,
  getSongForStreaming,
  updateSong,
  replaceCover,
  deleteSong,
  setPublication,
};
