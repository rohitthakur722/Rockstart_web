-- Phase 5: Admin Dashboard, Settings, Branding, Security Hardening
-- Adds user_preferences and admin_audit_logs, plus indexes supporting the
-- new admin/settings query patterns. Preserves all existing rows in every
-- table — nothing here drops or recreates users/songs/artists/albums/genres/
-- likes/playlists/history/refresh_tokens. Safe to re-run: every statement is
-- idempotent.
-- Usage: psql -d rockstar -f database/migrations/004_admin_settings_release.sql

BEGIN;

-- ============================================================
-- user_preferences: one row per user, created on first read/write.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  theme_preference VARCHAR(10) NOT NULL DEFAULT 'system',
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  compact_layout BOOLEAN NOT NULL DEFAULT FALSE,
  autoplay_next BOOLEAN NOT NULL DEFAULT TRUE,
  remember_player_state BOOLEAN NOT NULL DEFAULT TRUE,
  keyboard_shortcuts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE user_preferences
    ADD CONSTRAINT user_preferences_theme_check
    CHECK (theme_preference IN ('system', 'dark', 'light'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- admin_audit_logs: append-only record of administrative actions.
-- admin_user_id is nullable + ON DELETE SET NULL so a log entry can never
-- block or be destroyed by a future change to the acting user's row; there
-- is no user-deletion endpoint today, but the log should outlive one anyway.
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

-- Supports GET /api/admin/audit-logs default (newest first) and date-range filtering.
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at DESC);
-- Supports filtering audit logs by administrator.
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON admin_audit_logs (admin_user_id);
-- Supports filtering audit logs by target type + target id (e.g. "history for song 42").
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);

-- ============================================================
-- users: indexes for admin listing/filtering and final-admin-protection counts.
-- ============================================================
-- Supports GET /api/admin/users role+status filter combinations, and the
-- "how many active administrators remain" check before demoting/suspending.
CREATE INDEX IF NOT EXISTS users_role_is_active_idx ON users (role, is_active);
-- Supports the admin dashboard's "recent registrations" and the default
-- admin user-listing sort (newest first).
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

-- ============================================================
-- songs: indexes for admin moderation listing and dashboard counts.
-- ============================================================
-- Supports GET /api/admin/songs status filter + recency sort, and the
-- dashboard's published/draft counts and "recent uploads" list.
CREATE INDEX IF NOT EXISTS songs_is_published_created_at_idx ON songs (is_published, created_at DESC);
-- Supports GET /api/admin/songs uploader filter combined with status filter.
CREATE INDEX IF NOT EXISTS songs_uploaded_by_is_published_idx ON songs (uploaded_by, is_published);

-- ============================================================
-- refresh_tokens: index for the active-sessions list (GET /api/users/me/sessions).
-- ============================================================
-- Partial index — only rows that could actually appear in an "active
-- sessions" listing are indexed; revoked/expired history isn't queried here.
CREATE INDEX IF NOT EXISTS refresh_tokens_active_by_user_idx
  ON refresh_tokens (user_id, expires_at DESC) WHERE revoked_at IS NULL;

COMMIT;
