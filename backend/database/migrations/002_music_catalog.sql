-- Phase 3: Music Catalog
-- Adds catalog integrity constraints and indexes on top of the existing
-- artists/albums/genres/songs/song_genres tables from Phase 1.
-- Preserves all existing rows (users, tokens, and any catalog data already present).
-- Safe to re-run: every statement is idempotent.
-- Usage: psql -d rockstar -f database/migrations/002_music_catalog.sql

BEGIN;

-- ============================================================
-- artists: case-insensitive unique names
-- ============================================================
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT LOWER(name) FROM artists GROUP BY LOWER(name) HAVING COUNT(*) > 1
  ) dup;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique artist-name index: % case-insensitive duplicate artist name(s) exist. Resolve duplicates manually (merge or rename) before re-running this migration.',
      duplicate_count;
  END IF;
END $$;

DROP INDEX IF EXISTS artists_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS artists_name_lower_key ON artists (LOWER(name));

-- ============================================================
-- albums: case-insensitive unique (artist_id, title); block artist deletion
-- at the database level when albums still reference it (defense in depth —
-- the service layer is expected to check and reject first).
-- ============================================================
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT artist_id, LOWER(title) FROM albums GROUP BY artist_id, LOWER(title) HAVING COUNT(*) > 1
  ) dup;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique album index: % duplicate (artist, title) combination(s) exist. Resolve duplicates manually before re-running this migration.',
      duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS albums_artist_title_lower_key ON albums (artist_id, LOWER(title));

ALTER TABLE albums DROP CONSTRAINT IF EXISTS albums_artist_id_fkey;
ALTER TABLE albums
  ADD CONSTRAINT albums_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE RESTRICT;

-- ============================================================
-- songs: additional column, constraints, and indexes
-- ============================================================
ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_format VARCHAR(20);

DO $$
BEGIN
  ALTER TABLE songs ADD CONSTRAINT songs_title_not_blank_check CHECK (LENGTH(TRIM(title)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE songs ADD CONSTRAINT songs_release_year_upper_check CHECK (release_year IS NULL OR release_year <= 2100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS songs_release_year_idx ON songs (release_year);
CREATE INDEX IF NOT EXISTS songs_play_count_idx ON songs (play_count);
CREATE INDEX IF NOT EXISTS songs_created_at_idx ON songs (created_at);

COMMIT;
