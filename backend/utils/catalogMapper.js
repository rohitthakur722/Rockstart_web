const mapGenre = (row) => ({ id: row.id, name: row.name });

// `row` is a joined songs query result: song columns plus artist_name,
// album_title, album_cover_url, and a pre-aggregated `genres` JSON array
// (see model/song.model.js). `viewer` controls which fields are safe to
// include for the current caller (owner/admin vs. public).
const mapSong = (row, { viewer = null } = {}) => {
  const isOwner = viewer && String(viewer.id) === String(row.uploaded_by);
  const isAdmin = viewer?.role === "admin";
  const includeOwnerFields = Boolean(isOwner || isAdmin);

  const song = {
    id: row.id,
    title: row.title,
    artist: row.artist_id
      ? { id: row.artist_id, name: row.artist_name }
      : null,
    album: row.album_id
      ? { id: row.album_id, title: row.album_title, coverUrl: row.album_cover_url || null }
      : null,
    genres: Array.isArray(row.genres) ? row.genres.map(mapGenre) : [],
    coverUrl: row.cover_url || null,
    streamUrl: `/api/songs/${row.id}/stream`,
    durationSeconds: row.duration_seconds,
    audioFormat: row.audio_format || null,
    trackNumber: row.track_number ?? null,
    releaseYear: row.release_year ?? null,
    playCount: row.play_count !== undefined && row.play_count !== null ? Number(row.play_count) : 0,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeOwnerFields) {
    song.fileSize = row.file_size !== null && row.file_size !== undefined ? String(row.file_size) : null;
    song.mimeType = row.mime_type || null;
    song.uploadedBy = row.uploaded_by;
    song.isOwner = Boolean(isOwner);
  }

  return song;
};

const mapArtistSummary = (row) => ({
  id: row.id,
  name: row.name,
  imageUrl: row.image_url || null,
  albumCount: row.album_count !== undefined ? Number(row.album_count) : undefined,
  songCount: row.song_count !== undefined ? Number(row.song_count) : undefined,
});

const mapArtistDetail = (row, { albums = [], songs = [] } = {}) => ({
  id: row.id,
  name: row.name,
  bio: row.bio || null,
  imageUrl: row.image_url || null,
  albumCount: albums.length,
  songCount: songs.length,
  albums,
  songs,
  createdAt: row.created_at,
});

const mapAlbumSummary = (row) => ({
  id: row.id,
  title: row.title,
  coverUrl: row.cover_url || null,
  releaseDate: row.release_date || null,
  artist: row.artist_id ? { id: row.artist_id, name: row.artist_name } : null,
  songCount: row.song_count !== undefined ? Number(row.song_count) : undefined,
});

const mapAlbumDetail = (row, { songs = [], totalDurationSeconds = 0 } = {}) => ({
  id: row.id,
  title: row.title,
  coverUrl: row.cover_url || null,
  releaseDate: row.release_date || null,
  artist: row.artist_id ? { id: row.artist_id, name: row.artist_name } : null,
  songCount: songs.length,
  totalDurationSeconds,
  songs,
  createdAt: row.created_at,
});

module.exports = {
  mapGenre,
  mapSong,
  mapArtistSummary,
  mapArtistDetail,
  mapAlbumSummary,
  mapAlbumDetail,
};
