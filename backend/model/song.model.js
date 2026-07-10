const { query } = require("../config/db");

const runner = (client) => client || { query };

const SORT_COLUMNS = {
  title: "LOWER(s.title)",
  artist: "LOWER(ar.name)",
  album: "LOWER(al.title)",
  createdAt: "s.created_at",
  releaseYear: "s.release_year",
  duration: "s.duration_seconds",
  popularity: "s.play_count",
};

// audio_url is an internal file reference (never exposed by catalogMapper's
// mapSong, which builds streamUrl separately) — it's selected here because
// service-layer file cleanup (delete, cover replace) needs it.
const SELECT_COLUMNS = `
  s.id, s.title, s.artist_id, s.album_id, s.uploaded_by, s.audio_url, s.cover_url,
  s.duration_seconds, s.mime_type, s.audio_format, s.file_size, s.track_number,
  s.release_year, s.play_count, s.is_published, s.import_source, s.original_file_name,
  s.created_at, s.updated_at,
  ar.name AS artist_name,
  al.title AS album_title, al.cover_url AS album_cover_url,
  COALESCE(
    (SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
     FROM song_genres sg JOIN genres g ON g.id = sg.genre_id
     WHERE sg.song_id = s.id),
    '[]'::json
  ) AS genres
`;

const BASE_FROM = `
  FROM songs s
  LEFT JOIN artists ar ON ar.id = s.artist_id
  LEFT JOIN albums al ON al.id = s.album_id
`;

const buildPublicFilters = (params, { search, artistId, albumId, genreId, releaseYear }) => {
  const clauses = ["s.is_published = TRUE"];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(s.title ILIKE $${params.length} OR ar.name ILIKE $${params.length} OR al.title ILIKE $${params.length})`);
  }
  if (artistId) {
    params.push(artistId);
    clauses.push(`s.artist_id = $${params.length}`);
  }
  if (albumId) {
    params.push(albumId);
    clauses.push(`s.album_id = $${params.length}`);
  }
  if (releaseYear) {
    params.push(releaseYear);
    clauses.push(`s.release_year = $${params.length}`);
  }
  if (genreId) {
    params.push(genreId);
    clauses.push(`EXISTS (SELECT 1 FROM song_genres sg2 WHERE sg2.song_id = s.id AND sg2.genre_id = $${params.length})`);
  }

  return `WHERE ${clauses.join(" AND ")}`;
};

const findPublicList = async ({ search, artistId, albumId, genreId, releaseYear, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt;
  const params = [];
  const where = buildPublicFilters(params, { search, artistId, albumId, genreId, releaseYear });

  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} ${where}
     ORDER BY ${column} ${order}, s.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countPublicList = async ({ search, artistId, albumId, genreId, releaseYear }) => {
  const params = [];
  const where = buildPublicFilters(params, { search, artistId, albumId, genreId, releaseYear });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

const buildMineFilters = (params, { userId, status, search }) => {
  params.push(userId);
  const clauses = [`s.uploaded_by = $${params.length}`];

  if (status === "draft") clauses.push("s.is_published = FALSE");
  else if (status === "published") clauses.push("s.is_published = TRUE");

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(s.title ILIKE $${params.length} OR ar.name ILIKE $${params.length} OR al.title ILIKE $${params.length})`);
  }

  return `WHERE ${clauses.join(" AND ")}`;
};

const findMineList = async ({ userId, status, search, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt;
  const params = [];
  const where = buildMineFilters(params, { userId, status, search });

  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} ${where}
     ORDER BY ${column} ${order}, s.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countMineList = async ({ userId, status, search }) => {
  const params = [];
  const where = buildMineFilters(params, { userId, status, search });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

const findById = async (id) => {
  const result = await query(`SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE s.id = $1`, [id]);
  return result.rows[0] || null;
};

// Minimal row for streaming/playback-session bookkeeping: internal file
// reference, access-control fields, and duration (needed to compute the
// playback qualification threshold) — no title/artist/join overhead.
const findStreamInfoById = async (id) => {
  const result = await query(
    "SELECT id, audio_url, mime_type, file_size, is_published, uploaded_by, duration_seconds FROM songs WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

const findRecentlyAdded = async (limit) => {
  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE s.is_published = TRUE
     ORDER BY s.created_at DESC, s.id DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

const findPopular = async (limit) => {
  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE s.is_published = TRUE
     ORDER BY s.play_count DESC, s.created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

const findPublishedByArtist = async (artistId, limit = null) => {
  const params = [artistId];
  let limitClause = "";
  if (limit) {
    params.push(limit);
    limitClause = `LIMIT $${params.length}`;
  }
  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE s.artist_id = $1 AND s.is_published = TRUE
     ORDER BY s.created_at DESC ${limitClause}`,
    params
  );
  return result.rows;
};

// Bounded candidate pool for recommendation ranking: published songs by any
// of the given artists, most popular first.
const findPublishedByArtistIds = async (artistIds, limit) => {
  if (!artistIds || artistIds.length === 0) return [];
  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE s.artist_id = ANY($1::bigint[]) AND s.is_published = TRUE
     ORDER BY s.play_count DESC, s.created_at DESC
     LIMIT $2`,
    [artistIds, limit]
  );
  return result.rows;
};

const findPublishedByAlbum = async (albumId) => {
  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE s.album_id = $1 AND s.is_published = TRUE
     ORDER BY s.track_number ASC NULLS LAST, s.created_at ASC`,
    [albumId]
  );
  return result.rows;
};

const VALID_ADMIN_STATUSES = new Set(["all", "draft", "published"]);

const buildAdminFilters = (params, { status, search, uploaderId }) => {
  const clauses = [];

  if (status === "draft") clauses.push("s.is_published = FALSE");
  else if (status === "published") clauses.push("s.is_published = TRUE");

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(s.title ILIKE $${params.length} OR ar.name ILIKE $${params.length} OR al.title ILIKE $${params.length})`);
  }
  if (uploaderId) {
    params.push(uploaderId);
    clauses.push(`s.uploaded_by = $${params.length}`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
};

// Cross-user admin listing (unlike findMineList, not scoped to one uploader
// unless uploaderId is explicitly given) — backs GET /api/admin/songs.
const findAdminList = async ({ status, search, uploaderId, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt;
  const params = [];
  const where = buildAdminFilters(params, { status, search, uploaderId });

  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS},
            uploader.full_name AS uploader_full_name, uploader.username AS uploader_username
     ${BASE_FROM}
     LEFT JOIN users uploader ON uploader.id = s.uploaded_by
     ${where}
     ORDER BY ${column} ${order}, s.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countAdminList = async ({ status, search, uploaderId }) => {
  const params = [];
  const where = buildAdminFilters(params, { status, search, uploaderId });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

const create = async (
  {
    title,
    artistId,
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
    contentHash = null,
    importSource = "manual",
    originalFileName = null,
  },
  client
) => {
  const result = await runner(client).query(
    `INSERT INTO songs (
       title, artist_id, album_id, uploaded_by, audio_url, cover_url,
       duration_seconds, mime_type, audio_format, file_size, track_number,
       release_year, play_count, is_published, content_hash, import_source,
       original_file_name
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, FALSE, $13, $14, $15)
     RETURNING id`,
    [
      title,
      artistId,
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
      contentHash,
      importSource,
      originalFileName,
    ]
  );
  return result.rows[0].id;
};

// Per-user duplicate-import guard (see migrations/005_device_music_import.sql)
// — different users may still each import the same audio unhindered.
const findByUploaderAndContentHash = async (uploadedBy, contentHash, client) => {
  const result = await runner(client).query(
    "SELECT id FROM songs WHERE uploaded_by = $1 AND content_hash = $2",
    [uploadedBy, contentHash]
  );
  return result.rows[0] || null;
};

const updateMetadata = async (id, { title, artistId, albumId, trackNumber, releaseYear }, client) => {
  await runner(client).query(
    `UPDATE songs
     SET title = COALESCE($2, title),
         artist_id = COALESCE($3, artist_id),
         album_id = $4,
         track_number = COALESCE($5, track_number),
         release_year = COALESCE($6, release_year),
         updated_at = NOW()
     WHERE id = $1`,
    [id, title ?? null, artistId ?? null, albumId, trackNumber ?? null, releaseYear ?? null]
  );
};

const updateCoverUrl = async (id, coverUrl) => {
  await query("UPDATE songs SET cover_url = $2, updated_at = NOW() WHERE id = $1", [id, coverUrl]);
};

const updatePublication = async (id, isPublished) => {
  const result = await query(
    "UPDATE songs SET is_published = $2, updated_at = NOW() WHERE id = $1 RETURNING id",
    [id, isPublished]
  );
  return result.rows[0] || null;
};

const replaceGenres = async (songId, genreIds, client) => {
  await runner(client).query("DELETE FROM song_genres WHERE song_id = $1", [songId]);
  if (!genreIds || genreIds.length === 0) return;

  const values = genreIds.map((_, i) => `($1, $${i + 2})`).join(", ");
  await runner(client).query(
    `INSERT INTO song_genres (song_id, genre_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [songId, ...genreIds]
  );
};

const remove = async (id) => {
  await query("DELETE FROM songs WHERE id = $1", [id]);
};

module.exports = {
  SORT_COLUMNS,
  findPublicList,
  countPublicList,
  findMineList,
  countMineList,
  findAdminList,
  countAdminList,
  findById,
  findStreamInfoById,
  findRecentlyAdded,
  findPopular,
  findPublishedByArtist,
  findPublishedByArtistIds,
  findPublishedByAlbum,
  create,
  findByUploaderAndContentHash,
  updateMetadata,
  updateCoverUrl,
  updatePublication,
  replaceGenres,
  remove,
};
