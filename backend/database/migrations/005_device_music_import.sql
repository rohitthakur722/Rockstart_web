-- Phase 6 (feature/device-music-library): device-music import support.
-- Adds content_hash/import_source/original_file_name to songs, plus a
-- per-user duplicate-import guard. Preserves every existing row — nothing
-- here drops or recreates songs or any other table. Safe to re-run: every
-- statement is idempotent.
-- Usage: psql -d rockstar -f database/migrations/005_device_music_import.sql

BEGIN;

-- ============================================================
-- songs: identify how a song arrived, and its content fingerprint.
-- ============================================================
-- content_hash: streaming SHA-256 of the saved audio file, computed only for
-- imported songs (NULL for the normal manual-upload path) — lets the backend
-- detect the same user re-importing the same audio without hashing on every
-- request that doesn't need it.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS content_hash CHAR(64);

-- import_source: 'manual' (the existing upload form) or 'device_import' (this
-- phase's bulk import) — purely informational, never used for authorization.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS import_source VARCHAR(20) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  ALTER TABLE songs
    ADD CONSTRAINT songs_import_source_check
    CHECK (import_source IN ('manual', 'device_import'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- original_file_name: the device filename at import time, shown back to the
-- user in "My Uploads" / import history — never used to resolve a filesystem
-- path (audio_url remains the only server-managed file reference).
ALTER TABLE songs ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);

-- Per-user duplicate-import guard: the same uploader cannot import the same
-- audio content twice (they'd just get the existing song back instead — see
-- service/song.service.js's importSong). Two different users may still each
-- import the same audio; content_hash is deliberately not globally unique.
-- Partial (content_hash IS NOT NULL) so the existing manual-upload rows,
-- which never compute a hash, are entirely unaffected by this index.
CREATE UNIQUE INDEX IF NOT EXISTS songs_uploaded_by_content_hash_key
  ON songs (uploaded_by, content_hash) WHERE content_hash IS NOT NULL;

COMMIT;
