-- Rockstar Music Player -- Foundational seed data (Phase 1)
-- Safe to re-run: inserts are conflict-safe and touch no user-generated data.
-- Usage: psql -d rockstar -f database/seed.sql

BEGIN;

INSERT INTO genres (name) VALUES
  ('Pop'),
  ('Rock'),
  ('Hip-Hop'),
  ('Electronic'),
  ('Classical'),
  ('Jazz'),
  ('R&B'),
  ('Indie')
ON CONFLICT (LOWER(name)) DO NOTHING;

COMMIT;
