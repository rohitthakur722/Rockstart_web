-- Phase 4: Web Audio Player, Liked Songs, Playlists, Playback History, Recommendations
-- Extends the existing liked_songs/playlists/playlist_songs/playback_history tables
-- (all present since Phase 1) with the indexes, constraints, and columns Phase 4
-- needs. Preserves all existing rows. Safe to re-run: every statement is idempotent,
-- except the playlist-name-uniqueness step, which fails clearly (does not silently
-- delete data) if case-insensitive duplicate playlist names already exist for the
-- same user — the same pattern used for artist/album uniqueness in migration 002.
-- Usage: psql -d rockstar -f database/migrations/003_player_personal_library.sql

BEGIN;

-- ============================================================
-- liked_songs: additional lookup index for "recently liked" ordering.
-- (song_id index and the user_id+song_id primary key already exist from Phase 1.)
-- ============================================================
CREATE INDEX IF NOT EXISTS liked_songs_user_created_idx ON liked_songs (user_id, created_at DESC);

-- ============================================================
-- playlists: non-blank name, bounded length, case-insensitive unique name per user.
-- ============================================================
DO $$
BEGIN
  ALTER TABLE playlists ADD CONSTRAINT playlists_name_not_blank_check CHECK (LENGTH(TRIM(name)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT user_id, LOWER(name) FROM playlists GROUP BY user_id, LOWER(name) HAVING COUNT(*) > 1
  ) dup;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique playlist-name index: % user(s) have case-insensitive duplicate playlist names. Resolve duplicates manually (rename or merge) before re-running this migration.',
      duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_name_lower_key ON playlists (user_id, LOWER(name));

-- ============================================================
-- playlist_songs: same song can't appear twice in a playlist.
-- (playlist_id+position uniqueness already exists from Phase 1, guaranteeing
-- deterministic order; the primary key already prevents duplicate playlist_id+
-- song_id rows, i.e. the same song can't already appear twice.)
-- ============================================================

-- ============================================================
-- playback_history: extend for playback-session tracking.
-- ============================================================
ALTER TABLE playback_history
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(36),
  ADD COLUMN IF NOT EXISTS position_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE playback_history ADD CONSTRAINT playback_history_position_seconds_check CHECK (position_seconds >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing rows (from before this migration) have a NULL session_token; this
-- partial unique index only enforces uniqueness among rows that do have one.
CREATE UNIQUE INDEX IF NOT EXISTS playback_history_session_token_key
  ON playback_history (session_token) WHERE session_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS playback_history_user_played_at_idx ON playback_history (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS playback_history_user_song_played_at_idx ON playback_history (user_id, song_id, played_at DESC);
CREATE INDEX IF NOT EXISTS playback_history_qualified_idx ON playback_history (user_id, qualified_at DESC) WHERE qualified_at IS NOT NULL;

COMMIT;
