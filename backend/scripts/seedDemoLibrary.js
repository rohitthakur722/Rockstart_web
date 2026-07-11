#!/usr/bin/env node
/**
 * RockStar Demo Library seeder — makes the app immediately playable after
 * setup by inserting real, published PostgreSQL songs (with generated
 * original audio + cover art), streamed through the same production
 * pipeline as any other song. No commercial or copyrighted media is used.
 *
 * Usage:
 *   node scripts/seedDemoLibrary.js            # seed (idempotent — safe to rerun)
 *   node scripts/seedDemoLibrary.js --status    # report what's currently seeded
 *   node scripts/seedDemoLibrary.js --reset     # remove only demo_seed content
 *
 * Safety:
 *   - Refuses to run at all (seed, status, or reset) when NODE_ENV=production —
 *     this tool is for local/dev demo content only, not production data.
 *   - Idempotent: each demo song has a stable source_key; rerunning `seed`
 *     skips songs that already exist instead of inserting duplicates.
 *   - Reset only ever touches rows with import_source = 'demo_seed' and the
 *     managed files they reference — it never touches manual uploads,
 *     device imports, users, playlists, likes, or history.
 *   - Every file deletion is re-validated through the same managed-path
 *     containment check (utils/mediaFiles.js) the rest of the app uses.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { query, withTransaction, closePool } = require("../config/db");
const { MEDIA_DIRS, resolveManagedFilePath, extractManagedFilename } = require("../utils/mediaFiles");
const { synthesizeDemoTrackWav } = require("../utils/demoAudioSynth");
const { buildDemoCoverSvg } = require("../utils/demoArtworkGenerator");
const artistModel = require("../model/artist.model");
const albumModel = require("../model/album.model");
const genreModel = require("../model/genre.model");
const songModel = require("../model/song.model");

const STATUS_MODE = process.argv.includes("--status");
const RESET_MODE = process.argv.includes("--reset");

// Checked fresh on every call (not captured once at module load) so this
// guard is a genuine runtime safety check, not a stale snapshot of whatever
// NODE_ENV happened to be when the module was first required.
const assertNotProduction = (action) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Refusing to ${action} with NODE_ENV=production. The RockStar Demo Library is local/development ` +
        "demo content only — it must never be seeded into or reset from a real production database."
    );
  }
};

// --- Demo catalog definition -------------------------------------------------
// Original names/titles only — no real artists, albums, or songs. Chord
// progressions are simple, hand-picked, non-derivative loops (see
// utils/demoAudioSynth.js) — not a transcription of any existing recording.

const PROGRESSIONS = {
  warmMinor: [
    { root: "A3", quality: "min" },
    { root: "F3", quality: "maj" },
    { root: "C3", quality: "maj" },
    { root: "G3", quality: "maj" },
  ],
  jazzy: [
    { root: "C3", quality: "maj7" },
    { root: "A3", quality: "min7" },
    { root: "D3", quality: "min7" },
    { root: "G3", quality: "dom7" },
  ],
  open: [
    { root: "D3", quality: "min" },
    { root: "A3", quality: "min" },
    { root: "C3", quality: "maj" },
    { root: "G3", quality: "sus2" },
  ],
  bright: [
    { root: "E3", quality: "min" },
    { root: "C3", quality: "maj" },
    { root: "G3", quality: "maj" },
    { root: "D3", quality: "maj" },
  ],
};

const DEMO_CATALOG = [
  {
    artist: "RockStar Sessions",
    album: "After Hours",
    releaseDate: "2024-09-06",
    songs: [
      {
        key: "midnight-avenue",
        title: "Midnight Avenue",
        trackNumber: 1,
        releaseYear: 2024,
        genres: ["Lo-fi", "Instrumental"],
        music: { progression: PROGRESSIONS.warmMinor, bpm: 84, loops: 3, withArpeggio: true, withPercussion: true },
      },
      {
        key: "city-afterglow",
        title: "City Afterglow",
        trackNumber: 2,
        releaseYear: 2024,
        genres: ["Lo-fi", "Ambient"],
        music: { progression: PROGRESSIONS.jazzy, bpm: 78, loops: 3, withArpeggio: false, withPercussion: false },
      },
      {
        key: "last-train-home",
        title: "Last Train Home",
        trackNumber: 3,
        releaseYear: 2024,
        genres: ["Lo-fi"],
        music: { progression: PROGRESSIONS.open, bpm: 90, loops: 4, withArpeggio: true, withPercussion: true },
      },
    ],
  },
  {
    artist: "Velvet Circuit",
    album: "Golden Frequency",
    releaseDate: "2023-11-14",
    songs: [
      {
        key: "amber-skies",
        title: "Amber Skies",
        trackNumber: 1,
        releaseYear: 2023,
        genres: ["Electronic"],
        music: { progression: PROGRESSIONS.bright, bpm: 108, loops: 4, withArpeggio: true, withPercussion: true },
      },
      {
        key: "neon-rain",
        title: "Neon Rain",
        trackNumber: 2,
        releaseYear: 2023,
        genres: ["Electronic", "Ambient"],
        music: { progression: PROGRESSIONS.warmMinor, bpm: 100, loops: 4, withArpeggio: true, withPercussion: false },
      },
      {
        key: "static-bloom",
        title: "Static Bloom",
        trackNumber: 3,
        releaseYear: 2023,
        genres: ["Electronic", "Instrumental"],
        music: { progression: PROGRESSIONS.jazzy, bpm: 112, loops: 5, withArpeggio: true, withPercussion: true },
      },
    ],
  },
  {
    artist: "Northbound",
    album: "Open Roads",
    releaseDate: "2025-02-21",
    songs: [
      {
        key: "morning-signal",
        title: "Morning Signal",
        trackNumber: 1,
        releaseYear: 2025,
        genres: ["Indie"],
        music: { progression: PROGRESSIONS.bright, bpm: 96, loops: 4, withArpeggio: true, withPercussion: false },
      },
      {
        key: "quiet-horizon",
        title: "Quiet Horizon",
        trackNumber: 2,
        releaseYear: 2025,
        genres: ["Indie", "Ambient"],
        music: { progression: PROGRESSIONS.open, bpm: 72, loops: 3, withArpeggio: false, withPercussion: false },
      },
      {
        key: "slow-orbit",
        title: "Slow Orbit",
        trackNumber: 3,
        releaseYear: 2025,
        genres: ["Ambient", "Instrumental"],
        music: { progression: PROGRESSIONS.warmMinor, bpm: 68, loops: 3, withArpeggio: false, withPercussion: false },
      },
      {
        key: "paper-planes",
        title: "Paper Planes",
        trackNumber: 4,
        releaseYear: 2025,
        genres: ["Indie"],
        music: { progression: PROGRESSIONS.jazzy, bpm: 102, loops: 4, withArpeggio: true, withPercussion: true },
      },
    ],
  },
];

const SOURCE_KEY_PREFIX = "demo:";

// --- Helpers ---------------------------------------------------------------

const resolveOrCreateArtist = async (name, client) => {
  const existing = await artistModel.findByNameCI(name, client);
  if (existing) return existing;
  try {
    return await artistModel.create({ name }, client);
  } catch (err) {
    if (err.code === "23505") {
      const raceWinner = await artistModel.findByNameCI(name, client);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

const resolveOrCreateAlbum = async (artistId, title, { coverUrl, releaseDate }, client) => {
  const existing = await albumModel.findByArtistAndTitleCI(artistId, title, client);
  if (existing) return existing;
  try {
    return await albumModel.create({ artistId, title, coverUrl, releaseDate }, client);
  } catch (err) {
    if (err.code === "23505") {
      const raceWinner = await albumModel.findByArtistAndTitleCI(artistId, title, client);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

const resolveOrCreateGenre = async (name) => {
  const existing = await genreModel.findByNameCI(name);
  if (existing) return existing;
  try {
    return await genreModel.create({ name });
  } catch (err) {
    if (err.code === "23505") {
      const raceWinner = await genreModel.findByNameCI(name);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
};

const ensureManagedDirsExist = () => {
  for (const dir of Object.values(MEDIA_DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeManagedFile = (kind, extension, buffer) => {
  const filename = `${crypto.randomUUID()}.${extension}`;
  const destPath = path.join(MEDIA_DIRS[kind], filename);
  fs.writeFileSync(destPath, buffer);
  return { filename, url: `/uploads/${kind}/${filename}` };
};

const deleteManagedFileQuietly = (kind, url) => {
  const filename = extractManagedFilename(kind, url);
  const resolvedPath = filename && resolveManagedFilePath(kind, filename);
  if (!resolvedPath) return;
  try {
    fs.unlinkSync(resolvedPath);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[demo-seed] Could not remove ${kind}/${filename}: ${err.message}`);
  }
};

// --- Seed --------------------------------------------------------------------

const seedSong = async (artistRow, albumRow, songSpec) => {
  const sourceKey = `${SOURCE_KEY_PREFIX}${songSpec.key}`;

  const existing = await songModel.findBySourceKey(sourceKey);
  if (existing) {
    return { key: sourceKey, status: "skipped" };
  }

  const track = synthesizeDemoTrackWav(songSpec.music);
  const coverSvg = buildDemoCoverSvg({ seed: sourceKey, title: songSpec.title, subtitle: artistRow.name });

  let audioFile = null;
  let coverFile = null;
  try {
    audioFile = writeManagedFile("music", "wav", track.buffer);
    coverFile = writeManagedFile("covers", "svg", Buffer.from(coverSvg, "utf8"));

    const songId = await withTransaction(async (client) => {
      const genreRows = await Promise.all(songSpec.genres.map((name) => resolveOrCreateGenre(name)));

      const newSongId = await songModel.create(
        {
          title: songSpec.title,
          artistId: artistRow.id,
          albumId: albumRow.id,
          uploadedBy: null,
          audioUrl: audioFile.url,
          coverUrl: coverFile.url,
          durationSeconds: track.durationSeconds,
          mimeType: "audio/wav",
          audioFormat: "wav",
          fileSize: Buffer.byteLength(track.buffer),
          trackNumber: songSpec.trackNumber,
          releaseYear: songSpec.releaseYear,
          importSource: "demo_seed",
          sourceKey,
          isPublished: true,
        },
        client
      );

      await songModel.replaceGenres(newSongId, genreRows.map((g) => g.id), client);
      return newSongId;
    });

    return { key: sourceKey, status: "created", songId };
  } catch (err) {
    if (audioFile) deleteManagedFileQuietly("music", audioFile.url);
    if (coverFile) deleteManagedFileQuietly("covers", coverFile.url);
    return { key: sourceKey, status: "failed", error: err.message };
  }
};

const runSeed = async () => {
  assertNotProduction("seed the RockStar Demo Library");
  ensureManagedDirsExist();

  const results = [];
  for (const group of DEMO_CATALOG) {
    const artistRow = await resolveOrCreateArtist(group.artist);
    // The album cover is derived from the album's own stable identity (not
    // any one track's), so every song on the album can share it as a
    // fallback while each song's own cover stays track-specific.
    const albumSourceKey = `${SOURCE_KEY_PREFIX}album:${group.artist}:${group.album}`;
    const albumCoverSvg = buildDemoCoverSvg({ seed: albumSourceKey, title: group.album, subtitle: group.artist });
    const albumCoverFile = writeManagedFile("covers", "svg", Buffer.from(albumCoverSvg, "utf8"));
    const albumRow = await resolveOrCreateAlbum(artistRow.id, group.album, {
      coverUrl: albumCoverFile.url,
      releaseDate: group.releaseDate,
    });
    // If the album already existed, this run's freshly-written album cover
    // file is unused — remove it rather than leaving an orphan on disk.
    if (String(albumRow.cover_url) !== albumCoverFile.url) {
      deleteManagedFileQuietly("covers", albumCoverFile.url);
    }

    for (const songSpec of group.songs) {
      const result = await seedSong(artistRow, albumRow, songSpec);
      results.push({ artist: group.artist, album: group.album, title: songSpec.title, ...result });
    }
  }

  const created = results.filter((r) => r.status === "created");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");

  console.log(`\n[demo-seed] ${created.length} song(s) created, ${skipped.length} already present, ${failed.length} failed.`);
  created.forEach((r) => console.log(`[demo-seed]   + ${r.artist} — ${r.title}`));
  failed.forEach((r) => console.error(`[demo-seed]   ! ${r.artist} — ${r.title}: ${r.error}`));

  if (failed.length > 0) process.exitCode = 1;
  return { created, skipped, failed, results };
};

// --- Status ------------------------------------------------------------------

const runStatus = async () => {
  assertNotProduction("report demo-library status");

  const expectedKeys = DEMO_CATALOG.flatMap((g) => g.songs.map((s) => `${SOURCE_KEY_PREFIX}${s.key}`));
  const result = await query(
    "SELECT source_key, id, title, is_published FROM songs WHERE source_key = ANY($1::text[])",
    [expectedKeys]
  );
  const bySourceKey = new Map(result.rows.map((row) => [row.source_key, row]));

  console.log(`\n[demo-status] ${bySourceKey.size} of ${expectedKeys.length} expected demo songs are present.\n`);
  for (const group of DEMO_CATALOG) {
    console.log(`${group.artist} — ${group.album}`);
    for (const songSpec of group.songs) {
      const sourceKey = `${SOURCE_KEY_PREFIX}${songSpec.key}`;
      const row = bySourceKey.get(sourceKey);
      const status = row ? (row.is_published ? "seeded, published" : "seeded, DRAFT (unexpected)") : "missing";
      console.log(`  [${row ? "x" : " "}] ${songSpec.title} — ${status}`);
    }
  }

  const totalDemoRows = await query("SELECT COUNT(*) AS count FROM songs WHERE import_source = 'demo_seed'");
  console.log(`\nTotal rows with import_source='demo_seed' in the database: ${totalDemoRows.rows[0].count}`);
};

// --- Reset -------------------------------------------------------------------

const runReset = async () => {
  assertNotProduction("reset the RockStar Demo Library");

  const result = await query(
    "SELECT id, audio_url, cover_url FROM songs WHERE import_source = 'demo_seed'"
  );

  if (result.rows.length === 0) {
    console.log("[demo-reset] No demo_seed songs found — nothing to remove.");
    return { removedCount: 0 };
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM songs WHERE import_source = 'demo_seed'");
  });

  for (const row of result.rows) {
    deleteManagedFileQuietly("music", row.audio_url);
    if (row.cover_url) deleteManagedFileQuietly("covers", row.cover_url);
  }

  console.log(`[demo-reset] Removed ${result.rows.length} demo song(s) and their managed files.`);
  console.log("[demo-reset] Demo artists, albums, and genres were left in place (harmless if now unused);");
  console.log("[demo-reset] re-run `npm run demo:seed` to repopulate songs under them.");
  return { removedCount: result.rows.length };
};

// --- Entry point ---------------------------------------------------------

const main = async () => {
  try {
    if (STATUS_MODE) await runStatus();
    else if (RESET_MODE) await runReset();
    else await runSeed();
  } finally {
    await closePool();
  }
};

module.exports = {
  DEMO_CATALOG,
  SOURCE_KEY_PREFIX,
  runSeed,
  runStatus,
  runReset,
  assertNotProduction,
  // Exported for tests only (e.g. exercising failure cleanup in isolation) —
  // the CLI entry points above are runSeed/runStatus/runReset.
  seedSong,
  resolveOrCreateArtist,
  resolveOrCreateAlbum,
};

// Only auto-run as a CLI entry point (`node scripts/seedDemoLibrary.js`) —
// requiring this file as a module (e.g. from a test) must not trigger a
// seed/reset as a side effect of loading it.
if (require.main === module) {
  main().catch((err) => {
    console.error("[demo-seed] Fatal error:", err.message);
    process.exitCode = 1;
  });
}
