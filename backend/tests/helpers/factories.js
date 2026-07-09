/**
 * Direct-SQL test data factories. These bypass the HTTP/service layer for
 * speed and to avoid coupling every integration test's setup to unrelated
 * endpoints (e.g. a playlist test shouldn't fail because registration
 * validation changed). Each factory takes optional overrides, uses
 * parameterized SQL, and returns the inserted record.
 *
 * Uniqueness comes from crypto.randomUUID() per call rather than a shared
 * module-level counter, so factories stay safe under parallel `it()` blocks
 * within a file and never depend on call order.
 */
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { query } = require("../../config/db");

const uniqueSuffix = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const DEFAULT_TEST_PASSWORD = "Test-Password-123!";

const createUser = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  const fullName = overrides.fullName ?? `Test User ${suffix}`;
  const username = overrides.username ?? `user_${suffix}`;
  const email = overrides.email ?? `user_${suffix}@example.test`;
  const password = overrides.password ?? DEFAULT_TEST_PASSWORD;
  const role = overrides.role ?? "user";
  const isActive = overrides.isActive ?? true;

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS));

  const result = await query(
    `INSERT INTO users (full_name, username, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, full_name, username, email, role, is_active, created_at, updated_at`,
    [fullName, username, email, passwordHash, role, isActive]
  );

  return { ...result.rows[0], password };
};

const createAdmin = async (overrides = {}) => createUser({ ...overrides, role: "admin" });

const createArtist = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  const name = overrides.name ?? `Test Artist ${suffix}`;
  const bio = overrides.bio ?? null;
  const imageUrl = overrides.imageUrl ?? null;

  const result = await query(
    `INSERT INTO artists (name, bio, image_url) VALUES ($1, $2, $3)
     RETURNING id, name, bio, image_url, created_at, updated_at`,
    [name, bio, imageUrl]
  );
  return result.rows[0];
};

const createAlbum = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  const artist = overrides.artistId ? { id: overrides.artistId } : await createArtist();
  const title = overrides.title ?? `Test Album ${suffix}`;
  const coverUrl = overrides.coverUrl ?? null;
  const releaseDate = overrides.releaseDate ?? null;

  const result = await query(
    `INSERT INTO albums (artist_id, title, cover_url, release_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, artist_id, title, cover_url, release_date, created_at, updated_at`,
    [artist.id, title, coverUrl, releaseDate]
  );
  return result.rows[0];
};

const createGenre = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  const name = overrides.name ?? `Test Genre ${suffix}`;

  const result = await query(
    `INSERT INTO genres (name) VALUES ($1) RETURNING id, name, created_at`,
    [name]
  );
  return result.rows[0];
};

// `audioUrl` is a server-managed relative path, never a real uploaded file
// on disk unless a test explicitly copies one into TEST_UPLOAD_ROOT — most
// catalog/likes/playlist tests only need the DB row to exist, not a byte-
// for-byte file, since streaming tests build their own fixtures via testMedia.js.
const createSong = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  const artist = overrides.artistId ? { id: overrides.artistId } : await createArtist();

  const title = overrides.title ?? `Test Song ${suffix}`;
  const albumId = overrides.albumId ?? null;
  const uploadedBy = overrides.uploadedBy ?? null;
  const audioUrl = overrides.audioUrl ?? `music/test-${suffix}.wav`;
  const coverUrl = overrides.coverUrl ?? null;
  const durationSeconds = overrides.durationSeconds ?? 180;
  const mimeType = overrides.mimeType ?? "audio/wav";
  const audioFormat = overrides.audioFormat ?? "wav";
  const fileSize = overrides.fileSize ?? 1024;
  const trackNumber = overrides.trackNumber ?? null;
  const releaseYear = overrides.releaseYear ?? null;
  const isPublished = overrides.isPublished ?? true;
  const playCount = overrides.playCount ?? 0;

  const result = await query(
    `INSERT INTO songs (
       title, artist_id, album_id, uploaded_by, audio_url, cover_url,
       duration_seconds, mime_type, audio_format, file_size, track_number,
       release_year, play_count, is_published
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, title, artist_id, album_id, uploaded_by, audio_url, cover_url,
               duration_seconds, mime_type, audio_format, file_size, track_number,
               release_year, play_count, is_published, created_at, updated_at`,
    [
      title,
      artist.id,
      albumId,
      uploadedBy,
      audioUrl,
      coverUrl,
      durationSeconds,
      mimeType,
      audioFormat,
      fileSize,
      trackNumber,
      releaseYear,
      playCount,
      isPublished,
    ]
  );
  return result.rows[0];
};

const createPublishedSong = (overrides = {}) => createSong({ ...overrides, isPublished: true });
const createDraftSong = (overrides = {}) => createSong({ ...overrides, isPublished: false });

const addSongGenre = async (songId, genreId) => {
  await query(
    `INSERT INTO song_genres (song_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [songId, genreId]
  );
};

const createPlaylist = async (overrides = {}) => {
  const suffix = uniqueSuffix();
  if (!overrides.userId) {
    throw new Error("createPlaylist requires a userId override.");
  }
  const name = overrides.name ?? `Test Playlist ${suffix}`;
  const description = overrides.description ?? null;
  const isPublic = overrides.isPublic ?? false;

  const result = await query(
    `INSERT INTO playlists (user_id, name, description, is_public)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, description, cover_url, is_public, created_at, updated_at`,
    [overrides.userId, name, description, isPublic]
  );
  return result.rows[0];
};

const addSongToPlaylist = async (playlistId, songId, position = null) => {
  const result = await query(
    `INSERT INTO playlist_songs (playlist_id, song_id, position)
     SELECT $1, $2, COALESCE($3, (SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_songs WHERE playlist_id = $1))
     ON CONFLICT (playlist_id, song_id) DO NOTHING
     RETURNING playlist_id, song_id, position, added_at`,
    [playlistId, songId, position]
  );
  return result.rows[0] || null;
};

const likeSong = async (userId, songId) => {
  const result = await query(
    `INSERT INTO liked_songs (user_id, song_id) VALUES ($1, $2)
     ON CONFLICT (user_id, song_id) DO NOTHING
     RETURNING user_id, song_id, created_at`,
    [userId, songId]
  );
  return result.rows[0] || null;
};

const createPlaybackHistory = async (overrides = {}) => {
  if (!overrides.userId || !overrides.songId) {
    throw new Error("createPlaybackHistory requires userId and songId overrides.");
  }
  const sessionToken = overrides.sessionToken ?? crypto.randomUUID();
  const listenedSeconds = overrides.listenedSeconds ?? 0;
  const positionSeconds = overrides.positionSeconds ?? 0;
  const completed = overrides.completed ?? false;
  const qualifiedAt = overrides.qualifiedAt ?? null;
  const endedAt = overrides.endedAt ?? null;

  const result = await query(
    `INSERT INTO playback_history (
       user_id, song_id, session_token, listened_seconds, position_seconds,
       completed, qualified_at, ended_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, song_id, session_token, played_at, listened_seconds,
               position_seconds, completed, qualified_at, ended_at, updated_at`,
    [overrides.userId, overrides.songId, sessionToken, listenedSeconds, positionSeconds, completed, qualifiedAt, endedAt]
  );
  return result.rows[0];
};

module.exports = {
  DEFAULT_TEST_PASSWORD,
  createUser,
  createAdmin,
  createArtist,
  createAlbum,
  createGenre,
  createSong,
  createPublishedSong,
  createDraftSong,
  addSongGenre,
  createPlaylist,
  addSongToPlaylist,
  likeSong,
  createPlaybackHistory,
};
