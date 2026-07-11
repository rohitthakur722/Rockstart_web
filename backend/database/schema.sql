-- Rockstar Music Player -- Normalized PostgreSQL schema (Phases 1-5)
-- Applies cleanly to a fresh database: psql -d rockstar -f database/schema.sql

BEGIN;

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness without the citext extension.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (LOWER(username));

-- ============================================================
-- refresh_tokens (Phase 2: authentication sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_id BIGINT REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_key ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);

-- ============================================================
-- password_reset_tokens (Phase 2: password recovery)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_key ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);

-- ============================================================
-- artists
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  bio TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness: "Rockstar Artist" and "rockstar artist" collide.
CREATE UNIQUE INDEX IF NOT EXISTS artists_name_lower_key ON artists (LOWER(name));

-- ============================================================
-- albums
-- ============================================================
CREATE TABLE IF NOT EXISTS albums (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- RESTRICT (not CASCADE): an artist with existing albums cannot be deleted.
  -- The service layer rejects the deletion before this constraint is ever hit;
  -- this is a database-level safety net against uncontrolled cascades.
  artist_id BIGINT NOT NULL REFERENCES artists (id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  cover_url TEXT,
  release_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS albums_artist_id_idx ON albums (artist_id);
-- Case-insensitive uniqueness per artist: two different artists may still
-- share an album title, but one artist cannot have "Live" and "live" twice.
CREATE UNIQUE INDEX IF NOT EXISTS albums_artist_title_lower_key ON albums (artist_id, LOWER(title));

-- ============================================================
-- genres
-- ============================================================
CREATE TABLE IF NOT EXISTS genres (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS genres_name_lower_key ON genres (LOWER(name));

-- ============================================================
-- songs
-- ============================================================
CREATE TABLE IF NOT EXISTS songs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(200) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
  artist_id BIGINT REFERENCES artists (id) ON DELETE SET NULL,
  album_id BIGINT REFERENCES albums (id) ON DELETE SET NULL,
  uploaded_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
  -- Server-managed relative path under uploads/music. Never returned to
  -- clients directly — the public contract is GET /api/songs/:id/stream.
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  mime_type VARCHAR(100),
  audio_format VARCHAR(20),
  file_size BIGINT CHECK (file_size >= 0),
  track_number INTEGER CHECK (track_number >= 0),
  release_year SMALLINT CHECK (release_year IS NULL OR (release_year >= 1900 AND release_year <= 2100)),
  play_count BIGINT NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  -- Device-import support (Phase 6): content_hash is only ever set for
  -- imported songs (NULL for the manual-upload path); import_source is
  -- purely informational and never used for authorization.
  content_hash CHAR(64),
  import_source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (import_source IN ('manual', 'device_import', 'demo_seed')),
  original_file_name VARCHAR(255),
  -- Seeded-demo-library support (feature/professional-local-music): a
  -- stable, human-chosen slug (e.g. "demo:midnight-avenue") set only for
  -- demo_seed rows, which is what makes `npm run demo:seed` idempotent —
  -- NULL for manual uploads and device imports.
  source_key VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS songs_artist_id_idx ON songs (artist_id);
CREATE INDEX IF NOT EXISTS songs_album_id_idx ON songs (album_id);
CREATE INDEX IF NOT EXISTS songs_uploaded_by_idx ON songs (uploaded_by);
CREATE INDEX IF NOT EXISTS songs_title_idx ON songs (LOWER(title));
-- Per-user duplicate-import guard — see migrations/005_device_music_import.sql.
CREATE UNIQUE INDEX IF NOT EXISTS songs_uploaded_by_content_hash_key
  ON songs (uploaded_by, content_hash) WHERE content_hash IS NOT NULL;
-- Demo-library idempotency guard — see migrations/006_demo_library.sql.
CREATE UNIQUE INDEX IF NOT EXISTS songs_source_key_key
  ON songs (source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS songs_source_key_idx ON songs (source_key);
CREATE INDEX IF NOT EXISTS songs_is_published_idx ON songs (is_published);
CREATE INDEX IF NOT EXISTS songs_release_year_idx ON songs (release_year);
CREATE INDEX IF NOT EXISTS songs_play_count_idx ON songs (play_count);
CREATE INDEX IF NOT EXISTS songs_created_at_idx ON songs (created_at);

-- ============================================================
-- song_genres (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS song_genres (
  song_id BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  genre_id BIGINT NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  PRIMARY KEY (song_id, genre_id)
);

CREATE INDEX IF NOT EXISTS song_genres_genre_id_idx ON song_genres (genre_id);

-- ============================================================
-- liked_songs
-- ============================================================
CREATE TABLE IF NOT EXISTS liked_songs (
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  song_id BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS liked_songs_song_id_idx ON liked_songs (song_id);
CREATE INDEX IF NOT EXISTS liked_songs_user_created_idx ON liked_songs (user_id, created_at DESC);

-- ============================================================
-- playlists
-- ============================================================
CREATE TABLE IF NOT EXISTS playlists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playlists_user_id_idx ON playlists (user_id);
-- Case-insensitive uniqueness per user: one account cannot have "Focus" and
-- "focus" as two separate playlists.
CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_name_lower_key ON playlists (user_id, LOWER(name));

-- ============================================================
-- playlist_songs
-- ============================================================
CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id BIGINT NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  song_id BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (playlist_id, song_id)
);

CREATE INDEX IF NOT EXISTS playlist_songs_song_id_idx ON playlist_songs (song_id);
CREATE UNIQUE INDEX IF NOT EXISTS playlist_songs_position_key ON playlist_songs (playlist_id, position);

-- ============================================================
-- playback_history
-- ============================================================
CREATE TABLE IF NOT EXISTS playback_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  song_id BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  listened_seconds INTEGER NOT NULL DEFAULT 0 CHECK (listened_seconds >= 0),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  -- Phase 4: playback-session tracking for qualified-play detection.
  session_token VARCHAR(36),
  position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  qualified_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playback_history_user_id_idx ON playback_history (user_id);
CREATE INDEX IF NOT EXISTS playback_history_song_id_idx ON playback_history (song_id);
CREATE INDEX IF NOT EXISTS playback_history_played_at_idx ON playback_history (played_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS playback_history_session_token_key
  ON playback_history (session_token) WHERE session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS playback_history_user_played_at_idx ON playback_history (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS playback_history_user_song_played_at_idx ON playback_history (user_id, song_id, played_at DESC);
CREATE INDEX IF NOT EXISTS playback_history_qualified_idx ON playback_history (user_id, qualified_at DESC) WHERE qualified_at IS NOT NULL;

-- ============================================================
-- user_preferences (Phase 5: settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  theme_preference VARCHAR(10) NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system', 'dark', 'light')),
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  compact_layout BOOLEAN NOT NULL DEFAULT FALSE,
  autoplay_next BOOLEAN NOT NULL DEFAULT TRUE,
  remember_player_state BOOLEAN NOT NULL DEFAULT TRUE,
  keyboard_shortcuts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- admin_audit_logs (Phase 5: administrative action history)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(60),
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON admin_audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);

-- ============================================================
-- Phase 5: additional indexes for admin listing/filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS users_role_is_active_idx ON users (role, is_active);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS songs_is_published_created_at_idx ON songs (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS songs_uploaded_by_is_published_idx ON songs (uploaded_by, is_published);
CREATE INDEX IF NOT EXISTS refresh_tokens_active_by_user_idx
  ON refresh_tokens (user_id, expires_at DESC) WHERE revoked_at IS NULL;

COMMIT;
