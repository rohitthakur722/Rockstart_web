# Rockstar Music Player

A full-stack, premium-feeling music player web application. Rockstar mirrors the
look and feel of the Rockstar mobile app: dark, cinematic, minimal, and built
around a warm tan/gold brand identity.

This repository is being built in five phases. **This document reflects Phase 3**
— there is now a real, working music catalog: authenticated uploads, admin
moderation, search/filter/sort/pagination, and byte-range audio streaming.
Actual in-browser playback (a persistent player, queue, play/pause UI) is
still a later phase — Phase 3 catalogs and streams audio; it doesn't play it.

## Technology Stack

**Backend**
- Node.js + Express.js
- PostgreSQL via the `pg` driver — **no ORM or query builder** (no Prisma,
  Sequelize, TypeORM, Knex, or Drizzle). All SQL is raw and parameterized.
- CORS, cookie-parser, dotenv, Multer, bcrypt, jsonwebtoken, nodemailer
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
- Jest and Supertest will be introduced after the full feature set is built.
  The backend is structured now (`app.js` exports the Express app without
  starting a listener) specifically so it is easy to drive with Supertest later.

## Monorepo Structure

```
RockStar/
├── backend/
│   ├── config/          # env validation, PostgreSQL pool + transaction helper
│   ├── controller/       # auth, user, health, song, artist, album, genre, catalog
│   ├── service/          # business logic incl. song upload/streaming pipeline
│   ├── model/             # raw parameterized SQL (user, refreshToken, song, artist, album, genre, ...)
│   ├── routes/            # Express routers (one per resource)
│   ├── middleware/       # authenticate, optionalAuthenticate, authorize, error, upload-error
│   ├── validation/        # small hand-written request validators
│   ├── database/          # schema.sql, seed.sql, migrations/
│   ├── uploads/            # music/ (never served directly), covers/, profiles/
│   ├── utils/              # AppError, pagination, rangeParser, catalogMapper,
│   │                       # audioMetadata, fileSignature, mediaFiles, fileCleanup, uploadConfig
│   ├── app.js              # Express app (no listen)
│   └── server.js           # starts HTTP server, graceful shutdown
├── frontend/
│   └── src/
│       ├── api/            # axios instance + auth/user/song/artist/album/genre/catalog helpers
│       ├── context/         # AuthContext + AuthProvider
│       ├── hooks/            # useAuth, useCatalogParams, useDebouncedValue, ...
│       ├── components/     # common/, layout/, music/ (SongRow, MusicCard, DeleteSongDialog)
│       ├── layouts/        # AppLayout, AuthLayout
│       ├── pages/          # route-level pages, including pages/library/*
│       ├── routes/         # AppRouter, ProtectedRoute, PublicOnlyRoute
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
  auth rules from Phase 2, plus Phase 3 rules: music/image upload limits and
  catalog page-size limits must be positive integers within sane bounds, and
  the maximum page size can never be smaller than the default.
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
`authorizeRoles("admin")`) — this is Phase 3's moderation *foundation*; there
is no admin UI yet, so publishing currently happens via a direct API call.
Public catalog endpoints (`GET /api/songs`, Home, artist/album detail) only
ever return published songs.

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

`schema.sql` was also updated so a **fresh** database gets the complete
current schema (Phases 1–3) in one pass.

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
| frontend  | `npm run dev`    | Start Vite dev server            |
| frontend  | `npm run build`  | Production build                 |

## API Routes (Phase 3)

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

GET    /api/songs                    # public, published only, search/filter/sort/paginate
GET    /api/songs/mine               # authenticated, own drafts + published
POST   /api/songs                    # authenticated, multipart (audio + optional cover)
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
```

Uploaded avatars and covers are served read-only from `/uploads/profiles/`
and `/uploads/covers/`. Music audio is **never** served through
`express.static` — only through the streaming endpoint above.

## Frontend Routes (Phase 3)

Public: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
Authenticated users visiting the four auth pages are redirected to `/home`.

Protected (redirect guests to `/login`, restoring their original destination
after a successful login): `/home`, `/library`, `/library/uploads`,
`/library/upload`, `/songs/:songId`, `/artists/:artistId`,
`/albums/:albumId`, `/playlists`, `/liked`, `/profile`, `/settings`.

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

## Current Limitations

- No admin UI for publishing songs or managing artists/albums/genres yet —
  those endpoints exist and are fully functional, but are only reachable
  via direct API calls until Phase 5's admin dashboard.
- No in-browser playback yet — Phase 3 is catalog + streaming infrastructure
  only; there is no persistent player, queue, or play/pause UI.
- Email address is read-only after registration (no verified email-change
  flow yet).
- Password-reset email delivery requires SMTP configuration; without it,
  reset tokens still work end-to-end but no email is actually sent.
- No rate limiting on auth or upload endpoints yet.

## Phase 4 (Deferred)

Persistent audio player, playback queue, playlists, liked songs, playback
history, recommendations.

## Phase 5 (Deferred)

Admin dashboard (including a UI for the publish/unpublish and artist/album/
genre management endpoints that already exist), user administration,
production deployment, and the Jest/Supertest test suite.

## Testing Plan

Jest and Supertest are still deferred until the full feature set exists. The
backend's `app.js`/`server.js` split (the Express app is exported without
calling `.listen()`) exists specifically so Supertest can import `app.js`
directly once the test suite is added. Pagination, range-parsing, and
catalog-mapping logic were written as small pure functions
(`utils/pagination.js`, `utils/rangeParser.js`, `utils/catalogMapper.js`)
specifically to be easy to unit test later without needing a database.

## No-ORM Statement

This project intentionally does not use Prisma, Sequelize, TypeORM, Knex, or
Drizzle. All database access goes through `pg.Pool`/`pg.PoolClient` and
hand-written, parameterized SQL in the `model/` layer.
