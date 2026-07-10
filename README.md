# Rockstar Music Player

A full-stack, premium-feeling music player web application. Rockstar mirrors the
look and feel of the Rockstar mobile app: dark, cinematic, minimal, and built
around a warm tan/gold brand identity.

This repository was built in six phases. Phases 1–5 built the full feature
set: a persistent player and personal library, a real admin dashboard (user
management, music moderation, artist/album/genre administration, an audit
log), server-backed user settings (appearance, playback, privacy, security),
active-session management, account data export, and production security
hardening (Helmet, route-aware rate limiting, environment validation,
graceful shutdown). **Phase 6** added the automated test suite — see
[Testing](#testing) — a Jest + Supertest suite covering the backend API
against a real, isolated PostgreSQL test database, plus a handful of genuine
defects the suite surfaced and fixed along the way.

## Technology Stack

**Backend**
- Node.js + Express.js
- PostgreSQL via the `pg` driver — **no ORM or query builder** (no Prisma,
  Sequelize, TypeORM, Knex, or Drizzle). All SQL is raw and parameterized.
- CORS, cookie-parser, dotenv, Multer, bcrypt, jsonwebtoken, nodemailer
- Helmet (security headers + CSP), express-rate-limit (route-aware rate
  limiting), compression (gzip) — see [Security Hardening](#security-hardening-phase-5)
- `music-metadata` and `file-type` for server-side audio validation (both are
  ESM-only; loaded from the CommonJS backend via a small `import()` wrapper
  in `utils/audioMetadata.js` / `utils/fileSignature.js` rather than
  converting the whole backend to ESM)
- MVC architecture with a dedicated service layer
  (`routes → middleware → controller → service → model → PostgreSQL`)
- Nodemon for local development

**Frontend**
- Vite + React
- React Router
- Tailwind CSS
- Axios
- Auth/catalog state via React Context, URL search params, and small hooks —
  no Redux/Zustand/React Query

**Testing**
- Jest + Supertest, driving the real Express app (`app.js`, exported without
  starting a listener) against a real, isolated PostgreSQL database
  (`rockstar_test`) — never mocked, never the development database. See
  [Testing](#testing).

## Monorepo Structure

```
RockStar/
├── backend/
│   ├── config/          # env validation, PostgreSQL pool + transaction helper
│   ├── controller/       # auth, user, health, song, artist, album, genre, catalog,
│   │                     # like, playlist, playback, history, recommendation,
│   │                     # admin, adminUser, adminCatalog, adminAudit
│   ├── service/          # business logic incl. song upload/streaming pipeline,
│   │                     # playback-session lifecycle, recommendation ranking,
│   │                     # admin dashboard aggregates, adminUser (role/status +
│   │                     # final-admin protection), adminAudit, adminCatalog,
│   │                     # userPreference, session (active-session management),
│   │                     # dataExport
│   ├── model/             # raw parameterized SQL (user, refreshToken, song, artist, album, genre,
│   │                       # like, playlist, playbackHistory, admin, adminUser,
│   │                       # adminAudit, userPreference, ...)
│   ├── routes/            # Express routers (one per resource, incl. admin*.routes.js)
│   ├── middleware/       # authenticate, optionalAuthenticate, authorize, error,
│   │                     # upload-error, rateLimit, requestLogger
│   ├── validation/        # small hand-written request validators
│   ├── database/          # schema.sql, seed.sql, migrations/ (001–004)
│   ├── scripts/            # cleanupOrphanUploads.js (dry-run by default)
│   ├── uploads/            # music/ (never served directly), covers/, profiles/
│   ├── utils/              # AppError, pagination, rangeParser, catalogMapper,
│   │                       # audioMetadata, fileSignature, mediaFiles, fileCleanup, uploadConfig,
│   │                       # playbackQualification, recommendationRanking, version
│   ├── app.js              # Express app (no listen) — Helmet, rate limiting, compression
│   └── server.js           # starts HTTP server, graceful shutdown (repeated-signal + forced-timeout safe)
├── frontend/
│   └── src/
│       ├── api/            # axios instance + auth/user/song/artist/album/genre/catalog helpers,
│       │                   # + like/playlist/playback/history/recommendation/admin/preference/app helpers
│       ├── context/         # AuthContext/AuthProvider, PreferenceContext/PreferenceProvider,
│       │                    # PlayerContext/PlayerProvider, PersonalLibraryContext/PersonalLibraryProvider
│       ├── hooks/            # useAuth, usePreferences, usePlayer, usePersonalLibrary,
│       │                    # useAppVersion, useCatalogParams, useDebouncedValue, ...
│       ├── components/     # common/ (incl. Switch), admin/ (AdminMetricCard, AdminTable,
│       │                   # UserStatusBadge, MusicStatusBadge), layout/, music/, player/,
│       │                   # personal/, profile/ (ChangePasswordCard, ActiveSessionsCard)
│       ├── layouts/        # AppLayout, AuthLayout, AdminLayout
│       ├── pages/          # route-level pages, incl. pages/library/*, pages/liked/, pages/playlists/,
│       │                   # pages/history/, pages/player/, pages/admin/* (lazy-loaded)
│       ├── routes/         # AppRouter, ProtectedRoute, PublicOnlyRoute, AdminRoute
│       ├── utils/          # ... queue, playerStorage, playbackTime, appearanceStorage
│       └── ...
├── README.md
└── .gitignore
```

## Backend Architecture

Every API request flows through the same layers:

```
Route → Middleware → Controller → Service → Model → PostgreSQL (pg.Pool)
```

- **`config/db.js`** creates a single shared `pg.Pool`, exposes a `query`
  helper, a `withTransaction()` helper (BEGIN/COMMIT/ROLLBACK around a
  callback, client always released), a `checkConnection()` health probe, and
  `closePool()` for graceful shutdown.
- **`config/env.js`** validates required environment variables at startup —
  auth rules from Phase 2, Phase 3 rules (music/image upload limits and
  catalog page-size limits must be positive integers within sane bounds, and
  the maximum page size can never be smaller than the default), and Phase 5
  production-safety rules (JWT secrets must be real/distinct/long enough,
  `COOKIE_SECURE` must be true in production, no example placeholder values
  left in `DB_PASSWORD`, no dev-only reset-link exposure in production).
- All SQL is written by hand and parameterized (`$1`, `$2`, ...). No query
  ever concatenates user input into a SQL string.
- **`middleware/error.middleware.js`** is the single global error handler. It
  normalizes known Postgres constraint violations, malformed JSON, and Multer
  upload errors into clean 4xx responses, and only ever includes a stack
  trace for genuine unexpected 5xx errors in development.

## Music Catalog Architecture

### Upload pipeline

`POST /api/songs` accepts `multipart/form-data` with an `audio` field
(required) and an optional `cover` field, validated through multiple layers
before anything is written to the database:

1. Field name (Multer rejects unexpected fields outright)
2. Extension allowlist (`.mp3 .wav .m4a .mp4 .ogg` for audio; `.jpg .jpeg .png
   .webp` for covers)
3. Browser-reported MIME type allowlist
4. **Actual file signature** (`file-type` reads the real magic bytes — a
   renamed `.txt` claiming to be an MP3 is rejected here even if the browser
   MIME type lied)
5. Successful audio metadata parsing (`music-metadata` — a file that isn't
   really playable audio fails here even if its signature looked plausible)

Duration, MIME type, container/format, and file size are always **derived
server-side** from the saved file — a client can never claim a duration or
override these fields. Title/artist/track-number/release-year embedded in
the file's own tags are used only as a fallback when the uploader didn't
supply them.

Artist and album records are resolved case-insensitively ("Rockstar Artist"
and "rockstar artist" are the same artist) or created if they don't exist,
inside a single database transaction alongside the song insert and its
genre links — if any step fails, the whole transaction rolls back and any
files already written to disk are deleted, so uploads never leave a partial
song, an orphaned file, or a duplicate artist behind.

### Draft / publish workflow

Every new song starts as `is_published = false` (a private draft only the
uploader — or an admin — can see or stream). Ordinary users can upload, view,
edit, and delete their own songs, but **cannot publish them**. Publishing is
an admin-only action (`PATCH /api/songs/:id/publication`,
`authorizeRoles("admin")`) — Phase 3 built the moderation foundation; Phase 5
adds the actual admin UI (`/admin/music`) on top of it, reusing the same
service functions rather than duplicating the logic. Public catalog endpoints
(`GET /api/songs`, Home, artist/album detail) only ever return published
songs.

### Audio streaming

`GET /api/songs/:songId/stream` serves audio with full HTTP byte-range
support (`fs.createReadStream`, never `fs.readFile` — the whole file is never
loaded into memory):

- No `Range` header → `200` with the full file, `Accept-Ranges: bytes`
- Valid `Range: bytes=start-end` (including open-ended and suffix ranges like
  `bytes=1024-` or `bytes=-500`) → `206 Partial Content` with a correct
  `Content-Range`
- Unsatisfiable range (start beyond file size, empty file, etc.) → `416` with
  `Content-Range: bytes */<size>`
- Multiple/unsupported ranges degrade gracefully to a full `200` response
  rather than erroring

The physical file path is **always** resolved from the server-controlled
database reference through `utils/mediaFiles.js` (which verifies the
resolved path is actually inside `uploads/music/` before anything touches
the filesystem) — a request can never influence which file gets read.
`uploads/music/` is never mounted with `express.static`; the stream endpoint
is the only way audio bytes leave the server, and it enforces the same
draft/published + ownership rules as everything else. `play_count` is not
incremented by stream requests (seeking can fire many Range requests for one
listen — that's Phase 4 territory once real playback tracking exists).

### Ownership & ownership rules

| Action | Owner (uploader) | Other user | Admin |
|---|---|---|---|
| View own draft | ✅ | ❌ (404, not 403 — drafts don't leak existence) | ✅ |
| Edit metadata / replace cover / delete | ✅ | ❌ | ✅ |
| Publish / unpublish | ❌ | ❌ | ✅ |
| View/stream published songs | ✅ | ✅ | ✅ |

Artists and albums are deleted deliberately, not accidentally: the database
foreign key from `albums.artist_id` is `ON DELETE RESTRICT` (a defense-in-
depth safety net), and the service layer itself refuses to delete an artist
with any albums or songs still attached, or a genre still assigned to any
song — both return a clear `409` explaining what to remove first. Deleting
an album never deletes its songs or their audio files; `songs.album_id`
simply becomes `NULL` (this was already the schema's Phase 1 behavior).

## Authentication Architecture

Rockstar uses a short-lived **access token** + rotating **refresh token**
design:

- **Access token** — a JWT (`JWT_ACCESS_SECRET`, default 15-minute lifetime),
  returned in the JSON response body and kept **only in frontend memory**
  (never `localStorage`/`sessionStorage`). Sent as `Authorization: Bearer
  <token>`. Contains `sub` (user id), `role`, and `type: "access"`.
- **Refresh token** — a JWT (`JWT_REFRESH_SECRET`, default 7-day lifetime)
  delivered exclusively in an **HttpOnly** cookie scoped to `/api/auth`. Only
  its SHA-256 hash is ever stored in PostgreSQL (`refresh_tokens` table) —
  the raw token never touches the database. Every successful refresh
  **rotates** the token: the old row is atomically claimed and revoked
  before a new one is minted, which prevents concurrent refresh requests
  from creating parallel token chains. Reuse of an already-rotated/revoked
  refresh token is treated as a possible theft signal and revokes **every**
  active session for that user.
- Logout revokes the current refresh token server-side and clears the
  cookie. A previously issued **access token remains cryptographically valid
  until its own short expiry** even after logout — that is an inherent
  property of stateless JWTs, not a bug.
- Password change and password reset both revoke **all** of a user's refresh
  sessions, forcing a fresh login everywhere.
- `GET /api/songs`, `/api/songs/:id`, and `/api/songs/:id/stream` use an
  **optional**-authentication middleware: a valid token attaches `req.user`
  (so owners see their own drafts and an `isOwner` flag), but no token is
  required at all for published content.

### Frontend session handling

- `frontend/src/services/authTokenStore.js` holds the access token in a
  plain module-level variable — not React state, not storage.
- `frontend/src/api/axiosInstance.js` attaches the access token to outgoing
  requests, and on a single `401` response transparently attempts one
  refresh (coalesced so concurrent failing requests only trigger one
  network call) before retrying; a failed refresh clears auth state.
- `frontend/src/context/AuthProvider.jsx` owns the current user and a
  `checking → authenticated | unauthenticated` session status. On app start
  it calls `POST /api/auth/refresh` once (using the HttpOnly cookie) to
  silently restore a session across page reloads/browser restarts.

## Database

PostgreSQL schema lives in `backend/database/schema.sql` and is idempotent
(`CREATE TABLE IF NOT EXISTS`). Phase 3's migration,
`backend/database/migrations/002_music_catalog.sql`, adds on top of the
existing catalog tables (all statements are idempotent and safe to re-run):

- **`artists`** — a case-insensitive **unique index** on `name` (the
  migration first checks for existing duplicates and raises a clear error
  rather than silently deleting anything if any are found).
- **`albums`** — a case-insensitive unique index on `(artist_id, title)` (two
  different artists may share an album title; one artist may not have the
  same title twice), and its `artist_id` foreign key changed from `CASCADE`
  to `RESTRICT`.
- **`songs`** — added `audio_format`; added a non-blank `title` check and an
  upper bound on `release_year`; added indexes on `release_year`,
  `play_count`, and `created_at` to support catalog sorting.

```bash
psql -d rockstar -f backend/database/migrations/002_music_catalog.sql
```

Phase 4's migration, `backend/database/migrations/003_player_personal_library.sql`,
extends the `liked_songs`/`playlists`/`playlist_songs`/`playback_history` tables
that have existed since Phase 1 with the indexes, constraints, and columns
Phase 4 needs (idempotent and safe to re-run, like migration 002):

- **`liked_songs`** — an index on `(user_id, created_at DESC)` for "recently
  liked" ordering.
- **`playlists`** — a non-blank `name` check, and a case-insensitive unique
  index on `(user_id, name)` (checks for existing duplicates first and raises
  a clear error rather than silently resolving them, same as artist/album
  uniqueness in migration 002).
- **`playback_history`** — adds `session_token`, `position_seconds`,
  `qualified_at`, `ended_at`, and `updated_at` columns for playback-session
  tracking, a non-negative `position_seconds` check, a partial unique index on
  `session_token` (existing rows keep a `NULL` token and are unaffected), and
  indexes to support recent/qualified history queries.

```bash
psql -d rockstar -f backend/database/migrations/003_player_personal_library.sql
```

Phase 5's migration, `backend/database/migrations/004_admin_settings_release.sql`,
adds two new tables plus admin/settings-related indexes (idempotent, preserves
all existing data — no table is dropped or recreated):

- **`user_preferences`** — one row per user (`user_id` is the primary key,
  `ON DELETE CASCADE`), created on first read/write with sensible defaults
  (`theme_preference = 'system'`, `autoplay_next`/`remember_player_state`/
  `keyboard_shortcuts_enabled = true`, `reduce_motion`/`compact_layout =
  false`). `theme_preference` is constrained to `'system' | 'dark' | 'light'`.
- **`admin_audit_logs`** — append-only administrative action log
  (`admin_user_id` nullable + `ON DELETE SET NULL` so a log entry survives
  even if the acting account were ever removed), with indexes on
  `created_at DESC`, `admin_user_id`, and `(target_type, target_id)`.
- Additional indexes: `users (role, is_active)` and `users (created_at DESC)`
  for admin user listing/filtering and the final-admin-protection count;
  `songs (is_published, created_at DESC)` and `songs (uploaded_by,
  is_published)` for admin music moderation; a partial index on
  `refresh_tokens (user_id, expires_at DESC) WHERE revoked_at IS NULL` for
  the active-sessions list.

```bash
psql -d rockstar -f backend/database/migrations/004_admin_settings_release.sql
```

`schema.sql` was also updated so a **fresh** database gets the complete
current schema (Phases 1–5) in one pass.

### Supported formats & limits

| | Formats | Max size (default) |
|---|---|---|
| Audio | MP3, WAV, M4A, OGG | `MUSIC_UPLOAD_MAX_FILE_SIZE_MB` (50MB) |
| Song / album cover | JPEG, PNG, WebP | `IMAGE_UPLOAD_MAX_FILE_SIZE_MB` (5MB) |
| Avatar (unchanged from Phase 2) | JPEG, PNG, WebP | 5MB |

Multer's single global size limit is set to the larger (audio) figure so
audio uploads aren't truncated; the smaller cover limit is then enforced
explicitly right after upload, with both files cleaned up if the cover turns
out to be oversized — no oversized cover is ever left on disk.

## Environment Setup

### 1. PostgreSQL

```bash
createdb rockstar
psql -d rockstar -f backend/database/schema.sql
psql -d rockstar -f backend/database/seed.sql
```

(If upgrading an existing database from an earlier phase, run the relevant
migration file(s) in order instead of re-applying `schema.sql`.)

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

Backend runs at `http://localhost:5000`. Health check:
`http://localhost:5000/api/health`.

#### Environment variables (new in Phase 3)

| Variable | Purpose |
|---|---|
| `MUSIC_UPLOAD_MAX_FILE_SIZE_MB` | Max audio file size, e.g. `50` |
| `IMAGE_UPLOAD_MAX_FILE_SIZE_MB` | Max cover image size, e.g. `5` |
| `CATALOG_DEFAULT_PAGE_SIZE` | Default page size for catalog listings, e.g. `20` |
| `CATALOG_MAX_PAGE_SIZE` | Hard cap on requested page size, e.g. `100` |

(All Phase 2 auth/cookie/SMTP variables are unchanged — see git history or
the `.env.example` file for the full list.)

#### Environment variables (new in Phase 5)

| Variable | Purpose |
|---|---|
| `TRUST_PROXY` | Optional. Set to `true` only when running behind a real reverse proxy/load balancer, so Express trusts `X-Forwarded-*` for `req.ip`/`req.secure` (also used by the per-account rate limiters). Leave unset in local development. |

Rate limits (general API, auth, uploads, admin mutations, playback
heartbeat) are currently fixed, sensible defaults in
`backend/middleware/rateLimit.middleware.js` rather than environment
variables — see [Security Hardening](#security-hardening-phase-5).

#### Creating the first administrator

There is deliberately no role selector on the public registration form.
Register a normal account first, then promote it directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Run this only against your own controlled database — never expose an
admin-creation endpoint publicly, and never seed a default admin password.
The change takes effect on that account's next login **or** page
refresh/session-refresh (`POST /api/auth/refresh` re-reads the user row from
the database each time) — the in-memory user object from an existing tab
does not update itself immediately. Existing admins can also promote other
accounts from `/admin/users` without touching SQL again.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173` and talks to the backend through
`VITE_API_BASE_URL`.

## Development Commands

| Location  | Command          | Purpose                         |
|-----------|------------------|----------------------------------|
| backend   | `npm run dev`    | Start API with nodemon           |
| backend   | `npm start`      | Start API with node              |
| backend   | `npm run db:schema` | Apply `database/schema.sql`  |
| backend   | `npm run db:seed`   | Apply `database/seed.sql`    |
| backend   | `npm run demo:music` | Generate original demo WAV tracks + covers for testing Device Music, into gitignored `demo-media/` |
| frontend  | `npm run dev`    | Start Vite dev server            |
| frontend  | `npm run build`  | Production build                 |

## API Routes (Phases 1–5)

```
GET    /api/health
GET    /api

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me

GET    /api/users/me
PATCH  /api/users/me
PATCH  /api/users/me/avatar
PATCH  /api/users/me/password
GET    /api/users/me/preferences
PATCH  /api/users/me/preferences
GET    /api/users/me/sessions
DELETE /api/users/me/sessions/:sessionId
POST   /api/users/me/sessions/revoke-others
GET    /api/users/me/export           # downloadable JSON, no secrets/tokens

GET    /api/songs                    # public, published only, search/filter/sort/paginate
GET    /api/songs/mine               # authenticated, own drafts + published
POST   /api/songs                    # authenticated, multipart (audio + optional cover)
POST   /api/songs/import             # authenticated, multipart, lenient metadata fallback, per-user content-hash dedupe
GET    /api/songs/:songId            # published, or owner/admin for a draft
GET    /api/songs/:songId/stream     # byte-range audio streaming
PATCH  /api/songs/:songId            # owner/admin, metadata only
PATCH  /api/songs/:songId/cover      # owner/admin
PATCH  /api/songs/:songId/publication # admin only
DELETE /api/songs/:songId            # owner/admin

GET    /api/artists                  # public
GET    /api/artists/:artistId        # public
POST   /api/artists                  # admin
PATCH  /api/artists/:artistId        # admin
DELETE /api/artists/:artistId        # admin, blocked if albums/songs exist

GET    /api/albums                   # public
GET    /api/albums/:albumId          # public
POST   /api/albums                   # admin
PATCH  /api/albums/:albumId          # admin
DELETE /api/albums/:albumId          # admin

GET    /api/genres                   # public
POST   /api/genres                   # admin
PATCH  /api/genres/:genreId          # admin
DELETE /api/genres/:genreId          # admin, blocked if still assigned to songs

GET    /api/catalog/home             # recently added, popular, albums, artists, genres

GET    /api/likes                    # authenticated, paginated, user's liked songs
GET    /api/likes/ids                # authenticated, all liked song IDs (for LikeButton state)
PUT    /api/likes/:songId            # authenticated, idempotent, published songs only
DELETE /api/likes/:songId            # authenticated, idempotent

GET    /api/playlists                # authenticated, owner's playlists
POST   /api/playlists                # authenticated, non-blank + unique name per user
GET    /api/playlists/:playlistId    # authenticated, owner only (404 for non-owners)
PATCH  /api/playlists/:playlistId    # authenticated, owner only (rename/description)
DELETE /api/playlists/:playlistId    # authenticated, owner only (never deletes the songs/audio)
POST   /api/playlists/:playlistId/songs           # add, published songs only, duplicate-safe
DELETE /api/playlists/:playlistId/songs/:songId   # remove
PATCH  /api/playlists/:playlistId/order           # reorder, transaction-safe resequencing

POST   /api/playback/sessions                        # start, published song required
PATCH  /api/playback/sessions/:sessionToken/progress  # heartbeat, owner-only, clamped
POST   /api/playback/sessions/:sessionToken/end       # idempotent

GET    /api/history/recent           # authenticated, qualified plays, deduplicated
GET    /api/history/stats            # authenticated, real aggregate listening stats
DELETE /api/history                  # authenticated, clears this user's history only

GET    /api/recommendations          # authenticated, deterministic local-signal ranking

GET    /api/admin/dashboard          # admin only, real aggregate platform metrics

GET    /api/admin/users              # admin only, search/filter/sort/paginate
GET    /api/admin/users/:userId      # admin only
PATCH  /api/admin/users/:userId/role     # admin only, final-admin + self-protected, audit-logged
PATCH  /api/admin/users/:userId/status   # admin only, final-admin + self-protected, audit-logged

GET    /api/admin/songs              # admin only, cross-user listing (draft/published/uploader filters)
GET    /api/admin/songs/:songId      # admin only
PATCH  /api/admin/songs/:songId/publication  # admin only, audit-logged (reuses song.service)
DELETE /api/admin/songs/:songId      # admin only, audit-logged (reuses song.service)

GET    /api/admin/audit-logs         # admin only, paginated + filterable

# Artist/Album/Genre admin mutations reuse the existing routes above
# (POST/PATCH/DELETE /api/artists|albums|genres) — audit-logged, not duplicated.
```

Uploaded avatars and covers are served read-only from `/uploads/profiles/`
and `/uploads/covers/`. Music audio is **never** served through
`express.static` — only through the streaming endpoint above.

## Frontend Routes (Phases 1–5)

Public: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
Authenticated users visiting the four auth pages are redirected to `/home`.

Protected (redirect guests to `/login`, restoring their original destination
after a successful login): `/home`, `/library`, `/library/uploads`,
`/library/upload`, `/songs/:songId`, `/artists/:artistId`,
`/albums/:albumId`, `/playlists`, `/playlists/:playlistId`, `/liked`,
`/history`, `/player`, `/profile`, `/settings`.

Admin-only (guarded by `AdminRoute` — redirects guests to `/login` and
non-admins to `/home`; the real security boundary is still the backend, which
re-verifies `role` from the database on every request): `/admin`,
`/admin/users`, `/admin/music`, `/admin/artists`, `/admin/albums`,
`/admin/genres`, `/admin/audit-logs`. Each admin page is lazy-loaded
(`React.lazy`), so ordinary users never download that code.

Library search/filter/sort/pagination state lives in the URL
(`/library?tab=songs&search=rock&sort=title&order=asc&page=1`), so it
survives a refresh, works with Back/Forward, and is shareable. Stale
requests from rapid filter changes are cancelled with `AbortController`
rather than racing to overwrite newer results.

## Catalog Features

- **Library** — Songs/Albums/Artists tabs, live search (debounced), sort,
  and backend-driven pagination. Honest empty and no-results states — no
  fixture data is ever shown as if it came from the database.
- **Home** — Recently Added, Popular, Albums to Explore, Artists in
  Rockstar, and Browse by Genre, all built from real published catalog
  data. When the catalog is empty, an honest "just getting started" state
  points to Upload Music instead of showing anything fake.
- **Upload Music** (`/library/upload`) — drag-and-drop or file-picker audio
  selection, live client-side format/size checks, genre chips, cover
  preview, upload progress, and a clear notice that the uploader must own
  the audio or have permission to upload it.
- **My Uploads** (`/library/uploads`) — All/Draft/Published filter, search,
  and per-song Manage/Delete actions. Never shows another user's drafts.
- **Song / Artist / Album detail pages** — full metadata, genre chips,
  duration/format/file-size, and (for the owner or an admin) edit-metadata,
  replace-cover, and delete actions with an accessible confirmation dialog
  that explains exactly what will and won't be deleted.

## Device Music (Local Scanning, Playback & Import)

`/library/device` (reached via "Scan Device Music" on the Library page) lets
a signed-in user browse and play audio files straight from their own device
— entirely separate from the server-backed catalog above — and, if they
choose to, explicitly import selected tracks into their RockStar account.

### Browser permission model

**RockStar can only scan files and folders a user explicitly chooses.**
There is no automatic, background, or silent filesystem access:

- **Primary method** — `window.showDirectoryPicker({ mode: "read" })`
  (Chromium-based browsers), feature-detected and only ever invoked from a
  button click. Recurses read-only through the chosen directory
  (`frontend/src/services/deviceMusicScanner.js`'s `iterateDirectoryFiles`);
  never requests write access; a cancelled picker resolves to `null`, not an
  error.
- **Fallback method** — a hidden `<input type="file" webkitdirectory>` for a
  folder-equivalent selection, plus a plain `<input type="file" multiple>`
  ("Select Audio Files") that works in every browser, including Firefox and
  Safari, which don't implement `showDirectoryPicker`.
- **Drag and drop** — an optional third method; dropped files are normalized
  through the same pipeline as the other two.
- Every entry point requires an explicit user action first; the page states
  up front, "RockStar can only scan files and folders that you choose."

### Scanning

`deviceMusicScanner.js` owns feature detection, recursion, format
filtering, fingerprinting, and metadata extraction — kept out of
`DeviceLibraryPage.jsx` so the page stays a thin UI layer. Files are
processed through a small dependency-free concurrency limiter
(`runWithConcurrency`, 4 at a time) so scanning a large folder doesn't block
the UI or parse hundreds of files at once. Each file gets a fast, local-only
fingerprint (SHA-256 over its relative path + size + last-modified time,
never its contents) for a stable id, plus a content-based SHA-256 hash
(bounded to files under 100MB, computed with the same limited concurrency)
for genuine duplicate detection across differently-named files. Cancellation
is cooperative via `AbortController`, checked between files, and a user
cancellation surfaces as a normal "cancelled" state, never an error.

Each scanned file resolves to one status — `playable`, `unsupported`,
`duplicate`, or `metadata_error` — determined by a two-layer format check:
an extension/MIME allowlist (MP3, WAV, M4A, MP4/AAC, OGG, Opus, FLAC, WebM
audio) followed by a real `audio.canPlayType()` probe, since format support
genuinely varies by browser. Unsupported files stay visible in the scan
summary but are excluded from the playable queue and from Play All/Shuffle
All.

### Metadata and artwork

Metadata extraction uses the current, maintained **`music-metadata`**
package (not the discontinued `-browser` fork) via its browser-compatible
`parseBlob`/`selectCover` exports — confirmed by inspecting the installed
package's conditional exports (`lib/core.js`, built on `strtok3`'s
Blob-based tokenizer, with no Node-only APIs). It's loaded with a **lazy
dynamic `import()`**, not a static one: `DeviceLibraryProvider` lives in the
always-mounted provider tree in `App.jsx`, so a static import would ship
`music-metadata`'s parsers (~130KB gzipped) to every visitor, not just the
ones who open Device Music. Extracted fields (title, artist, album, album
artist, track/disc number, year, genre, duration, codec, container,
bitrate, embedded picture) fall back, in order:

- **Title** — embedded title → filename without its extension → "Unknown Track"
- **Artist** — embedded artist → embedded album artist → "Unknown Artist"
- **Album** — embedded album → parent folder name → "Unknown Album"

None of this requires the user to type anything before local playback works.

When a file has embedded artwork, the first suitable picture
(`selectCover`) becomes a `Blob` → `URL.createObjectURL` — revoked when the
track leaves the library (`clearLibrary`) or the provider unmounts. When
there's no embedded artwork (true for most of this project's own generated
demo tracks), **`GeneratedArtwork.jsx`** renders a deterministic, RockStar-
styled cover (near-black gradient, warm tan/gold accent, one of a few
restrained geometric motifs, the track's initials) computed from a
non-cryptographic hash of a stable seed — the same track always renders the
same design, and nothing is ever downloaded. This same fallback also now
covers server songs, albums, and artists with no uploaded cover — see
`SongRow`, `MusicCard`, and `PlayerArtwork`.

### Local playback

Device tracks share the app's single global `HTMLAudioElement` — no
per-song audio element is ever created. `PlayerProvider` resolves a track's
source through one function:

```js
const resolvePlaybackSource = (song) =>
  song.sourceType === "device" ? song.localPlaybackUrl : buildMediaUrl(song.streamUrl);
```

`localPlaybackUrl` is a `URL.createObjectURL(file)` created on demand by
`useDeviceLibrary().getPlaybackUrl()` when a queue is built (not eagerly for
every scanned file) — `PlayerProvider` never imports `DeviceLibraryContext`
itself, keeping the two providers decoupled. Queue, shuffle, repeat, seek,
volume, and mute all work identically for device and server tracks; a
"Device" badge appears next to the title in the mini/full player bar and
the full player page. Because `startSessionForCurrentSong` bails out
immediately for `sourceType === "device"`, device playback **never** opens
a server playback session — meaning it never increments `play_count` and
never writes a listening-history row; likes and playlist actions are hidden
for device tracks (`LikeButton`, `SongActionsMenu`) since neither is
meaningful without a server-side song id. Device tracks are also excluded
from the periodic `localStorage` restoration snapshot — a `File` object
can't survive `JSON.stringify` or a reload, and one must never be persisted
there — so route navigation within a session preserves device playback
exactly like server playback, but a full page reload requires re-selecting
the folder/files (documented on the page itself).

### RockStar import

Scanning **never** uploads anything. Import is a separate, explicit,
multi-step action: select tracks → press "Import Selected" → confirm in a
dialog that states what will happen → tracks upload with **2 at a time**
concurrency, per-track progress, and a **Retry** action for any track that
fails (successful imports are never re-sent). The backend endpoint,
`POST /api/songs/import`, reuses the exact same authoritative pipeline as
the manual upload form (`song.service.js`) — authentication, Multer, real
file-signature validation, server-side metadata extraction, a generated
safe filename, a PostgreSQL transaction, ownership from `req.user.id`,
draft-by-default status, and cleanup on failure — but with its own, more
lenient validator (`validateSongImportInput`) that never requires a title or
artist name, falling back to the filename / "Unknown Artist" exactly like
the frontend does for local display. The client-supplied duration, MIME
type, file size, and publication status are never trusted — the server
re-derives all of them, the same as the manual path.

**Duplicate protection**: migration `005_device_music_import.sql` adds
`content_hash`, `import_source`, and `original_file_name` to `songs`, plus a
partial unique index on `(uploaded_by, content_hash)`. The server computes a
streaming SHA-256 of the saved file; if this exact content was already
imported by this same user, the newly-saved duplicate file is deleted and
their existing song is returned — no second row is ever created. A
different user importing the same audio is unaffected (the index is
per-user, not global).

Imported songs are always created with `is_published = false`, exactly like
a manual upload — they appear in "My Uploads" (tagged `Imported`, showing
their original filename), can be edited like any other draft, and are never
exposed through the public catalog. Device-local playback of the original
file remains available regardless of the imported copy's draft status; the
two are independent copies (one on-device, one on the server).

### Privacy and demo media

The Device Music page states plainly, before any import: "Only import audio
that you own or have permission to use," that scanning never uploads
automatically, that RockStar cannot access folders that weren't selected,
and that clearing the on-page library only removes browser references —
never the original files on disk.

For local testing without any commercial audio,
`backend/scripts/setupDemoMusic.js` (`npm run demo:music`) synthesizes a
handful of short, original WAV tracks locally (simple sine-wave
scale/arpeggio patterns — no copied melodies, no network access) plus a
generated SVG cover per track, into a gitignored `backend/demo-media/`
directory, along with a `licenses.json` manifest recording each track's
title, source ("generated"), and license statement. Nothing is downloaded
from the internet by this script; a Mode B (downloading genuinely
public-domain/CC0 audio with a recorded license) is documented as a future
option but was **not** implemented, since verifying real third-party
licensing terms isn't something this script can safely automate.

### Known limitations

- Directory-handle persistence (remembering a picked folder across visits
  via IndexedDB, and re-querying/re-prompting for permission) is
  implemented for the File System Access API path; the `webkitdirectory`
  fallback cannot restore a `FileList` after a reload — the user re-selects
  it, and the page says so.
- A local, IndexedDB-only "Device Favorites" feature was intentionally left
  out of this pass — it's independent of everything above and easy to add
  later without touching the scanning/playback/import pipeline.

## Player & Personal Library Architecture (Phase 4)

### One global audio element

`PlayerProvider` (`frontend/src/context/PlayerProvider.jsx`) owns exactly one
`HTMLAudioElement`, created once in a mount-only effect and never recreated
by route changes or re-renders. No other component — `SongRow`, `PlayerBar`,
`PlayerPage`, page components — creates its own `Audio()`; everything reads
and controls playback only through `usePlayer()`. Mutable per-tick playback
state (current queue, session token, repeat mode, accumulated listened
seconds) is kept in refs so imperative event handlers (native `timeupdate`,
`ended`, etc.) always read fresh values without becoming effect dependencies.

### Queue, shuffle, repeat

Every playable list (Home sections, Library, an album's tracklist, an
artist's songs, liked songs, a playlist, search results) passes its own
contextual queue into `playQueue(songs, startIndex)` — selecting a song
starts the queue at the clicked item's index, and changing an unrelated
page's filters afterward does not silently replace the already-playing
queue. Shuffle (`utils/queue.js`) keeps the currently-playing song first,
shuffles the rest, and preserves the pre-shuffle order so toggling shuffle
off restores it. Repeat has three modes — off / all / one — and governs both
natural `ended` transitions and the previous/next boundary behavior
(previous restarts the current song if more than ~3s in; wraps only under
repeat-all).

### Playback sessions, qualification, and play counts

Starting playback opens a server-tracked playback session
(`POST /api/playback/sessions`); the client sends a progress heartbeat
roughly every 12 seconds (`PATCH .../progress`) — not on every `timeupdate`
tick — and a best-effort final update on `ended`/logout/tab-close
(`POST .../end`, also attempted via `pagehide` with `keepalive`). A play only
"qualifies" (counts toward `play_count` and history) once the listened time
clears a deterministic threshold, computed once in
`backend/utils/playbackQualification.js` and never duplicated elsewhere:

```
threshold = min(durationSeconds, 30, max(5, ceil(durationSeconds * 0.25)))
```

So a 3s clip qualifies after 3s, a 20s clip after 5s, a 60s song after 15s,
and anything 120s+ after the 30s cap. Qualification and the `play_count`
increment each happen at most once per session (guarded by the session's
`qualified_at IS NULL` check), so repeated heartbeats, seeking, or scrubbing
never double-count a play, and merely opening/clicking play without
listening does not count at all.

### Liked songs, playlists, history, recommendations

- **Liked songs** — one shared liked-ID set lives in `PersonalLibraryProvider`
  so every heart icon across the app (SongRow, PlayerBar, detail pages)
  reflects the same state; liking/unliking is optimistic with rollback on
  failure, and concurrent taps on the same song share one in-flight request.
- **Playlists** — owner-only CRUD, case-insensitive unique names per user,
  published-songs-only additions, duplicate-membership prevention, and
  transaction-safe reordering. Deleting a playlist never deletes the songs
  or their audio.
- **History** — `/history` shows qualified, deduplicated recent plays and
  real aggregate stats (listening time, unique songs, top artist/album, most
  played); clearing history removes only that user's history rows and never
  touches the catalog's global `play_count`.
- **Recommendations** — `backend/utils/recommendationRanking.js` scores
  published songs from transparent, explainable signals (liked
  artists/albums/genres, recent qualified plays, catalog popularity and
  recency) with deterministic tie-breaking — no ML, no external model. The UI
  labels results honestly (e.g. "Based on Your Listening", "From Artists You
  Like") rather than an unexplained "recommended for you".

### Media Session, keyboard shortcuts, restoration, logout

- **Media Session** — feature-detected (`"mediaSession" in navigator`); when
  supported, `PlayerProvider` sets `MediaMetadata` (title/artist/album/
  artwork), registers `play`/`pause`/`previoustrack`/`nexttrack`/
  `seekbackward`/`seekforward`/`seekto`/`stop` handlers, and keeps
  `playbackState`/position state in sync. Entirely absent on browsers without
  support — ordinary playback never depends on it.
- **Keyboard shortcuts** (`PlayerBar`) — Space (play/pause), Left/Right
  (seek), Up/Down (volume), M (mute), N/P (next/previous); ignored while
  focus is in an input, textarea, select, or `contenteditable` element, and
  cleaned up when the player bar unmounts.
- **Restoration** — on login, a per-user, versioned, size-bounded snapshot
  (queue, position, volume, mute, shuffle, repeat) is restored from
  `localStorage` **paused** (never autoplays); invalid or oversized snapshots
  are rejected. The snapshot is cleared on logout.
- **Logout** — pauses playback, ends the active session best-effort, stops
  the heartbeat, and clears the in-memory queue/current song and the
  persisted snapshot — so Account B never sees Account A's queue, likes, or
  playlists. None of this deletes the underlying database rows; a user's
  likes, playlists, and history are exactly as they left them next login.

### Known browser limitations

- Autoplay: browsers may block `audio.play()` outside a user gesture (e.g.
  after restoring a session or on certain automatic transitions); Rockstar
  catches the rejected promise and surfaces "press Play to continue" rather
  than crashing.
- Media Session support and behavior (lock-screen/OS media controls,
  `setPositionState`, individual action availability) varies by browser and
  OS; everything degrades to "no OS-level media controls" rather than
  breaking in-page playback.

## Admin Dashboard & Moderation (Phase 5)

### Authorization

Every `/api/admin/*` route requires `authenticate` (valid, active session)
**and** `authorizeRoles("admin")`. Role is never trusted from the request
body, query parameters, or frontend state — `authenticate.middleware.js`
re-reads the user row from PostgreSQL on every single request, so a
demoted/suspended admin loses access immediately, not just after their token
expires. The frontend's `AdminRoute` guard and the conditional "Admin"
sidebar link are UX conveniences only; they are not the security boundary.

### Dashboard

`GET /api/admin/dashboard` returns only real, current-state aggregates — user
counts (total/active/suspended/administrators), catalog counts
(songs/published/draft, artists, albums, genres, playlists), platform-wide
qualified plays and listening time, bounded "recent registrations"/"recent
uploads" lists, and real most-played songs. No fabricated growth
percentages, revenue, or engagement charts.

### User management

`/admin/users` supports search (name/username/email), role/status filters,
sorting, and pagination. Role changes and suspend/reactivate both:

- Reject the acting admin targeting **themselves** (self-demotion and
  self-suspension are blocked at the API, not just a disabled button).
- Reject an action that would leave **zero active administrators** — the
  check locks every active-admin row (`FOR UPDATE`) inside a transaction, so
  two concurrent demotions can't both succeed and empty the admin set.
- Revoke the target's refresh-token sessions immediately, so a privilege
  change or suspension takes effect everywhere without waiting for their
  access token to expire naturally.
- Write an audit-log entry.

Suspension is clearly labeled "Suspend"/"Reactivate" — never presented as
deletion; suspending never deletes a user's likes, playlists, or history.

### Music moderation, artists, albums, genres

`/admin/music` lists every song across every uploader (draft/published/
uploader filters), and reuses the existing `song.service.js` functions for
publish/unpublish/delete rather than duplicating that logic — the admin
layer only adds the cross-user listing query and audit logging around the
same calls. Deleting a song as an admin removes the database record, the
managed audio file, and the song's own cover, but never touches album
artwork.

Artist/Album/Genre administration (`/admin/artists`, `/admin/albums`,
`/admin/genres`) reuses the **existing** Phase 3 endpoints
(`POST`/`PATCH`/`DELETE /api/artists|albums|genres`, already
`authorizeRoles("admin")`-gated) rather than introducing a parallel set of
admin-only routes — Phase 5 only adds the frontend UI and audit logging
around those same calls. Case-insensitive duplicate prevention and
safe-delete conflict checks (e.g. an artist with albums/songs still attached)
were already enforced by the service layer.

### Audit log

`admin_audit_logs` records: role changes, activation/suspension, song
publish/unpublish/admin-delete, and artist/album/genre create/update/delete
— each with the acting admin, action, target type/ID, safe JSON metadata
(never passwords, hashes, or tokens), and a timestamp. `/admin/audit-logs`
supports pagination and action/target-type filters, and renders readable
action descriptions rather than raw JSON.

## Settings & Preferences (Phase 5)

`/settings` replaced the Phase 1–4 placeholder page with five real sections:

- **Appearance** — System/Dark/Light theme, reduced motion, compact layout.
  All three are server-backed (`user_preferences`) and applied instantly via
  `data-theme`/`data-reduce-motion`/`data-compact` attributes on `<html>`,
  which the CSS in `frontend/src/index.css` keys off of — light and dark
  share the same warm tan/gold accent, just with an inverted surface
  hierarchy. `PreferenceProvider` caches the last-known values in
  `localStorage`, and `index.html` has a small inline script that applies
  them **before** React mounts (falling back to `prefers-color-scheme`/
  `prefers-reduced-motion` when nothing is cached yet), so there's no flash
  of the wrong theme on load.
- **Playback** — autoplay-next, remember-player-state, and keyboard-shortcuts
  toggles, consumed directly by `PlayerProvider`/`PlayerBar`: disabling
  autoplay-next stops playback at the end of the current song (repeat-one
  still repeats; manual Next/Previous still work); disabling
  remember-player-state clears any already-saved restoration snapshot and
  stops writing new ones; disabling keyboard shortcuts turns off `PlayerBar`'s
  global key handler entirely.
- **Privacy** — clear listening history (confirmation required; current user
  only; never touches global `play_count`, likes, or playlists) and a
  bounded JSON data export.
- **Security** — change password (shared component with Profile, not
  duplicated), active-session list with per-session revoke and "sign out
  other sessions," and a current-session logout.
- **About** — accurate version/phase, pulled from `GET /api` (backed by
  `backend/utils/version.js`, itself reading `package.json` — one source of
  truth, not duplicated across components).

### Active sessions

`refresh_tokens` already recorded `user_agent`/`ip_address`/`expires_at`;
Phase 5 adds `GET/DELETE /api/users/me/sessions` and `POST
/api/users/me/sessions/revoke-others` on top of it. The refresh cookie's
path was widened from `/api/auth` to `/api` (still HttpOnly/Secure, still
narrower than the whole origin) specifically so these `/api/users/me/*`
routes can read it to identify "the current session" — token hashes are
compared server-side only and never appear in any API response.

### Data export

`GET /api/users/me/export` returns a bounded, deliberately-structured JSON
download (profile, preferences, liked-song references, playlists with
membership, qualified listening history, uploaded-song metadata) — never
password hashes, tokens, SMTP config, server paths, or other users' data.

## Security Hardening (Phase 5)

- **Helmet** — secure headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Strict-Transport-Security`, `Referrer-Policy`) plus a Content-Security-
  Policy scoped to same-origin scripts/styles and this server's own
  `/uploads` + streaming endpoint for `img-src`/`media-src`; development
  relaxes `connect-src` for Vite's dev server/HMR websocket, production does
  not.
- **Rate limiting** (`express-rate-limit`, keyed per-account when
  authenticated, per-IP otherwise) — a generous global limit (300/min) for
  normal browsing and player heartbeats; a strict limit (10/15min, IP-keyed)
  on login/register/forgot-password/reset-password; a conservative limit
  (20/15min) on music/avatar/cover uploads; a moderate limit (60/min) on
  admin and artist/album/genre mutations; a heartbeat-aware limit (20/min) on
  the playback progress endpoint specifically, sized for a ~12s heartbeat
  interval with headroom for multiple tabs. All return a clean `429` JSON
  body, never a raw error page.
- **Request size limits** — JSON/urlencoded bodies capped at `100kb`
  (oversized bodies get a clean `413` through the normal error format, not a
  raw 500); file uploads still go through Multer's separately-configured
  size limits.
- **CORS** — a single configured origin (`CLIENT_URL`), credentials enabled,
  an explicit method/header allowlist — never a wildcard origin with
  credentials.
- **Cookies** — refresh token stays HttpOnly + Secure-in-production +
  configurable `SameSite`; `env.js` fails production startup if
  `COOKIE_SECURE` is false, or if `SameSite=None` is set without `Secure`.
- **CSRF** — the state-changing cookie-authenticated endpoints (refresh,
  logout) rely on strict CORS + `SameSite` rather than a separate CSRF-token
  scheme, since the frontend and backend are same-site in every supported
  deployment shape today; if a genuinely cross-site deployment is ever
  needed, a real CSRF-token strategy should be added rather than relying on
  CORS alone.
- **Environment validation** (`config/env.js`) — fails fast in production if
  JWT secrets are missing, match the `.env.example` placeholders, are too
  short, or are identical to each other; if `COOKIE_SECURE` is false; if
  `DEV_EXPOSE_RESET_LINK` is true; or if `DB_PASSWORD` is the example
  placeholder.
- **Logging** — one structured JSON line per request (method, route, status,
  duration, timestamp) — never headers, cookies, query/body values, or
  anything that could contain a credential.
- **Graceful shutdown** — `SIGINT`/`SIGTERM` close the HTTP server and the
  PostgreSQL pool before exiting; a repeated signal while already shutting
  down is ignored (not double-processed); a forced-exit timeout guards
  against a hang during shutdown.
- **Static file hardening** — only `/uploads/profiles` and `/uploads/covers`
  are ever mounted with `express.static` (dotfiles denied, directory index
  disabled); the raw music directory, backend root, `.env`, and database
  files are never reachable this way — audio only ever leaves through the
  access-controlled streaming route.
- **Upload cleanup tooling** — `backend/scripts/cleanupOrphanUploads.js`
  compares files on disk against database references for music/covers/
  profiles; dry-run by default, requires an explicit `--delete` flag, and
  re-validates every candidate path through the same containment check
  (`utils/mediaFiles.js`) the rest of the app uses before removing anything.
  Run via `npm run uploads:cleanup` / `npm run uploads:cleanup:delete`.

## Current Limitations

- Recommendations, likes, playlists, and history are per-account personal
  data — there is no public/shared playlist view yet (`playlists.is_public`
  exists in the schema but isn't surfaced by any endpoint or UI).
- Email address is read-only after registration (no verified email-change
  flow yet).
- Password-reset email delivery requires SMTP configuration; without it,
  reset tokens still work end-to-end but no email is actually sent.
- Rate limits are fixed defaults in code, not environment-configurable yet.
- No production hosting/deployment has been set up — see
  [Deployment Considerations](#deployment-considerations).
- CSRF protection relies on strict CORS/SameSite rather than a dedicated
  CSRF-token scheme (see [Security Hardening](#security-hardening-phase-5))
  — sufficient for same-site deployment, but worth revisiting if a
  cross-site frontend/backend split is ever needed.

## Deployment Considerations

Not yet configured, but relevant when it is:

- Set `NODE_ENV=production`, real (32+ character, distinct) JWT secrets,
  `COOKIE_SECURE=true`, and a real `CLIENT_URL` — `config/env.js` fails
  startup if these are missing or use example placeholders.
- Set `TRUST_PROXY=true` if deployed behind a reverse proxy/load balancer, so
  rate limiting and `req.secure` see the real client IP/protocol.
- PostgreSQL should be a managed/production instance, not the local dev
  database; run `schema.sql` (fresh install) or the numbered migrations
  (upgrading) against it directly, the same as local setup.
- Configure real SMTP credentials for password-reset email delivery, or
  password-reset tokens will still work end-to-end but no email will send.
- Serve the frontend's production build (`npm run build` → `frontend/dist`)
  from a static host/CDN; it talks to the backend purely over
  `VITE_API_BASE_URL`, so the two can be hosted separately.
- Run `backend/scripts/cleanupOrphanUploads.js` periodically (dry-run first)
  if uploads live on a persistent disk that isn't otherwise garbage-collected.

## Testing

Phase 6 added a Jest + Supertest suite (`backend/tests/`) covering the
backend API: 268 tests across 21 files, all passing, with 90%
statement / 92% line / 96% function / 69% branch coverage (thresholds:
75/75/70/65). Only `jest` and `supertest` were added as devDependencies — no
other test framework, ORM, or third-party testing service.

### Setup (one-time)

1. Have a local PostgreSQL server reachable with the same credentials as
   your dev `.env` (or your own — the test suite only ever touches its own
   database).
2. Copy the template and fill in your local Postgres connection details:
   ```bash
   cd backend
   cp .env.test.example .env.test
   ```
   `backend/.env.test` is gitignored and never committed. It **must not**
   point at the `rockstar` database — `DB_NAME` must end in `_test`
   (`.env.test.example` sets `DB_NAME=rockstar_test`).
3. Create the test database and apply the schema:
   ```bash
   npm run test:db:create
   ```

### Running tests

| Command | What it does |
|---|---|
| `npm test` | Full suite (unit + integration), serial (`--runInBand`) |
| `npm run test:unit` | Only `tests/unit/**` — pure functions, no database |
| `npm run test:integration` | Only `tests/integration/**` — real HTTP + real Postgres |
| `npm run test:coverage` | Full suite with a coverage report |
| `npm run test:watch` | Watch mode for local iteration |
| `npm run test:detect-open-handles` | Diagnostic run for hung Jest workers |
| `npm run test:db:create` | Create `rockstar_test` (if missing) and apply `schema.sql` |
| `npm run test:db:reset` | Truncate every application table in `rockstar_test` |

`npm test` **never** touches the `rockstar` database. A hard runtime guard
(`tests/helpers/assertTestDatabase.js`) runs before every destructive
operation and refuses to proceed unless `NODE_ENV=test`, `DB_NAME` ends in
`_test`, and `DB_NAME` is not `rockstar` — misconfiguration aborts loudly
instead of touching the wrong database.

### How it's isolated from the real app

- **Database** — `rockstar_test`, created/schema'd once per run
  (`globalSetup`), truncated between test files (`TRUNCATE ... RESTART
  IDENTITY CASCADE` on every application table) via `truncateAllTables()`.
  Database-backed tests run serially to avoid concurrent-truncation races.
- **Uploads** — `TEST_UPLOAD_ROOT` (`backend/tests/.tmp/uploads`) is only
  ever honored when `NODE_ENV=test`, and `utils/mediaFiles.js` refuses to
  resolve to anything outside the backend project or equal to the real
  `uploads/` directory. Test uploads are wiped after each run
  (`globalTeardown`) and never interact with real dev uploads.
  `app.js`'s static file serving for `/uploads/profiles` and `/uploads/covers`
  reads from this same resolved root, so an uploaded avatar/cover is
  actually retrievable in tests, not just written to disk.
  See [Defects found and fixed](#defects-found-and-fixed-by-the-test-suite).
- **Rate limiters** — each limiter (`middleware/rateLimit.middleware.js`)
  uses an explicit, named `MemoryStore` rather than an implicit default one,
  and exports `resetAllRateLimiters()`. Test files that make many
  register/login calls reset all limiter state in a `beforeEach` so
  legitimate test traffic never trips the real, unmodified 10-per-15-minute
  auth limit.
- **Reset-link exposure** — `TEST_EXPOSE_RESET_LINK=true` is a separate flag
  from dev's `DEV_EXPOSE_RESET_LINK`, so password-reset tests can capture the
  reset token deterministically without depending on (or being masked by)
  whatever a developer has set locally.
- **No mocking of the app itself** — Supertest always imports `backend/app.js`
  (never `server.js`, so a real TCP port is never opened), and integration
  tests exercise real Express routing/middleware, real PostgreSQL (via the
  same `config/db.js` pool the app itself uses), real bcrypt hashing, real
  JWTs, and the real filesystem. Only genuinely external/nondeterministic
  boundaries are mocked or stubbed — SMTP is simply unconfigured in
  `.env.test` (email delivery no-ops safely and the tests never depend on it).

### What's covered

- **Unit** (`tests/unit/`, no database): playback-qualification thresholds,
  Range-header parsing (full/partial/suffix/unsatisfiable), pagination
  bounds, field validators, and recommendation ranking/scoring.
- **Integration** (`tests/integration/`, real HTTP + real Postgres): health/
  root, full auth lifecycle (register/login/refresh-rotation/reuse-detection/
  logout/forgot-password/reset-password), profile/avatar/preferences/
  password-change, active-session management, data export, public catalog
  browsing, admin CRUD for artists/albums/genres, song upload (real WAV/PNG
  fixtures, signature validation, metadata-derived duration), ownership and
  publication rules, byte-range audio streaming, likes, playlists (CRUD +
  transactional reorder), playback sessions and qualification, listening
  history, recommendations, the full admin surface (dashboard, user
  management including the final-administrator and self-action protections,
  music moderation, audit log), and cross-cutting concerns (security
  headers, CORS, rate-limit responses, and the API's error-response shape).
- Test data factories (`tests/helpers/factories.js`) insert directly via
  parameterized SQL for speed; auth flows (`tests/helpers/auth.js`) always
  go through the real HTTP register/login endpoints, since exercising the
  real auth contract is the point.
- Programmatic test media (`tests/helpers/testMedia.js`) — a real, minimal
  WAV file with an accurate header (so the server's actual duration-parsing
  logic can be asserted against), a real minimal PNG/JPEG, and deliberately
  invalid buffers for negative-path tests. No committed commercial audio.

### Defects found and fixed by the test suite

Building this suite surfaced four genuine, pre-existing defects (each fixed
via the smallest correct change, verified with a failing-then-passing test,
not by weakening a test or an authorization check):

1. **Avatar uploads skipped content validation.** `song.service.js` already
   verified a cover image's real byte signature before accepting it;
   `user.service.js`'s avatar upload never did, so a non-image file with a
   spoofed extension/MIME type would be accepted and served publicly. Fixed
   by extracting the shared `validateImageSignature()` check into
   `utils/fileSignature.js` and using it for avatars too.
2. **Static file serving ignored the test upload root.** `app.js` mounted
   `/uploads/profiles` and `/uploads/covers` from a hardcoded real path,
   while `utils/mediaFiles.js` already correctly redirected writes under
   `NODE_ENV=test`. An uploaded test avatar/cover would 404 when fetched
   back. Fixed by having `app.js` mount from the same `MEDIA_DIRS` the rest
   of the app already uses.
3. **Refresh-token reuse detection was over-broad.** Any token presented
   with `revoked_at` set — whether revoked because it was legitimately
   *rotated* (a real theft signal) or revoked by an *explicit* action
   (logout, revoking one session, "sign out other devices", changing
   password) — triggered a mass revocation of every session for that user.
   A stale cached token from a device the user had already, intentionally,
   signed out of would silently log them out everywhere else too. Fixed in
   `auth.service.js` by only treating `replaced_by_token_id`-set tokens (the
   actual rotation-reuse signal) as theft; an explicitly-revoked token now
   just reports "session expired."
4. **Jest + ESM-only dependency interop.** `music-metadata` and `file-type`
   are ESM-only, loaded via dynamic `import()`; Jest's default CommonJS
   module environment throws on this without a Node flag. Fixed by running
   Jest with `NODE_OPTIONS=--experimental-vm-modules` (baked into every
   `test*` npm script) — a test-runner configuration fix, not a production
   code change.

### Coverage exclusions

`server.js` (starts the real listener + signal handling — exercised
manually, since tests must never open a real TCP port) and
`config/env.js` (a startup-only environment guard, invoked only from
`server.js`) are excluded from coverage collection for the same reason:
neither is reachable through the HTTP layer Supertest drives. No service,
controller, or model is excluded.

## No-ORM Statement

This project intentionally does not use Prisma, Sequelize, TypeORM, Knex, or
Drizzle. All database access goes through `pg.Pool`/`pg.PoolClient` and
hand-written, parameterized SQL in the `model/` layer.
