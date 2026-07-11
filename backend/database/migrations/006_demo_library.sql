-- feature/professional-local-music: seeded RockStar Demo Library support.
-- Adds songs.source_key (a stable identifier for seeded demo songs, e.g.
-- "demo:midnight-avenue") and extends import_source to allow 'demo_seed'.
-- Preserves every existing row — nothing here drops or recreates songs, or
-- any other table, or deletes any user, song, artist, album, or genre. Safe
-- to re-run: every statement is idempotent.
-- Usage: psql -d rockstar -f database/migrations/006_demo_library.sql

BEGIN;

-- ============================================================
-- songs: stable identity for seeded demo content.
-- ============================================================
-- source_key is only ever set for demo-seeded songs (NULL for manual
-- uploads and device imports) — it's what makes `npm run demo:seed`
-- idempotent: rerunning it looks up existing rows by this key instead of
-- inserting duplicates.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source_key VARCHAR(120);

-- Global uniqueness (not per-user, unlike content_hash): every demo song's
-- key is a fixed, human-chosen slug shared across the whole seeded catalog,
-- not scoped to an uploader — demo songs use uploaded_by = NULL.
CREATE UNIQUE INDEX IF NOT EXISTS songs_source_key_key
  ON songs (source_key) WHERE source_key IS NOT NULL;

-- Extend import_source to allow 'demo_seed' alongside the existing
-- 'manual'/'device_import' values. Postgres has no ADD VALUE IF NOT EXISTS
-- for CHECK constraints, so the old constraint is dropped and recreated —
-- this only changes what values are *allowed*, it does not touch any
-- existing row's data.
ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_import_source_check;
ALTER TABLE songs ADD CONSTRAINT songs_import_source_check
  CHECK (import_source IN ('manual', 'device_import', 'demo_seed'));

-- Supports admin/catalog queries that want to identify or exclude seeded
-- demo content specifically.
CREATE INDEX IF NOT EXISTS songs_source_key_idx ON songs (source_key);

COMMIT;
