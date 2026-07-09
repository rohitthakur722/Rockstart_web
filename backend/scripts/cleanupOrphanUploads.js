#!/usr/bin/env node
/**
 * Orphan-upload inspection/cleanup tool.
 *
 * Compares files actually present under backend/uploads/{music,covers,profiles}
 * against every database reference to those directories, and reports (or, in
 * --delete mode, removes) files that no row references anymore — e.g. left
 * behind by a crash between writing a file and committing its database row.
 *
 * Usage:
 *   node scripts/cleanupOrphanUploads.js            # dry run (default) — reports only
 *   node scripts/cleanupOrphanUploads.js --delete    # actually deletes orphans
 *
 * Safety:
 *   - Dry-run by default; deletion requires the explicit --delete flag.
 *   - Every candidate path is re-validated through the same path-containment
 *     check (mediaFiles.js) used by the rest of the app before any unlink —
 *     nothing outside the three managed directories is ever touched.
 *   - .gitkeep files are always skipped.
 *   - A missing managed directory is reported and skipped, not an error.
 *   - Only relative filenames are logged — never absolute filesystem paths.
 */
require("dotenv").config();
const fs = require("fs/promises");
const { query, closePool } = require("../config/db");
const { MEDIA_DIRS, resolveManagedFilePath } = require("../utils/mediaFiles");

const DELETE_MODE = process.argv.includes("--delete");

const listManagedFilenames = async (dir) => {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((name) => name !== ".gitkeep");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(`[cleanup] Directory does not exist, skipping: ${dir}`);
      return null;
    }
    throw err;
  }
};

// Extracts just the filename from a stored "/uploads/<kind>/<filename>" value.
const filenameFromUrl = (kind, url) => {
  if (!url) return null;
  const prefix = `/uploads/${kind}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
};

const getReferencedFilenames = async (kind) => {
  const referenced = new Set();

  if (kind === "music") {
    const result = await query("SELECT audio_url FROM songs WHERE audio_url IS NOT NULL");
    result.rows.forEach((row) => {
      const name = filenameFromUrl("music", row.audio_url);
      if (name) referenced.add(name);
    });
  } else if (kind === "covers") {
    const [songs, albums] = await Promise.all([
      query("SELECT cover_url FROM songs WHERE cover_url IS NOT NULL"),
      query("SELECT cover_url FROM albums WHERE cover_url IS NOT NULL"),
    ]);
    [...songs.rows, ...albums.rows].forEach((row) => {
      const name = filenameFromUrl("covers", row.cover_url);
      if (name) referenced.add(name);
    });
  } else if (kind === "profiles") {
    const result = await query("SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL");
    result.rows.forEach((row) => {
      const name = filenameFromUrl("profiles", row.avatar_url);
      if (name) referenced.add(name);
    });
  }

  return referenced;
};

const inspectKind = async (kind, dir) => {
  console.log(`\n[cleanup] Inspecting "${kind}" (${dir})`);

  const onDisk = await listManagedFilenames(dir);
  if (onDisk === null) return { kind, orphans: [], skipped: true };

  const referenced = await getReferencedFilenames(kind);

  const orphans = [];
  for (const filename of onDisk) {
    if (referenced.has(filename)) continue;

    // Anything that doesn't match our own generated-filename pattern is left
    // alone entirely — it's not something this tool recognizes as "ours" to
    // manage, so it's neither reported as orphaned nor ever deleted.
    const resolvedPath = resolveManagedFilePath(kind, filename);
    if (!resolvedPath) {
      console.warn(`[cleanup]   Skipping unrecognized filename (not our pattern): ${kind}/${filename}`);
      continue;
    }

    orphans.push({ filename, resolvedPath });
  }

  console.log(`[cleanup]   ${onDisk.length} file(s) on disk, ${referenced.size} referenced, ${orphans.length} orphaned.`);
  return { kind, orphans, skipped: false };
};

const run = async () => {
  console.log(`[cleanup] Mode: ${DELETE_MODE ? "DELETE (destructive)" : "dry run (default, no files will be removed)"}`);

  const results = await Promise.all(
    Object.entries(MEDIA_DIRS).map(([kind, dir]) => inspectKind(kind, dir))
  );

  const allOrphans = results.flatMap((r) => r.orphans.map((o) => ({ kind: r.kind, ...o })));

  if (allOrphans.length === 0) {
    console.log("\n[cleanup] No orphaned files found.");
  } else {
    console.log(`\n[cleanup] ${allOrphans.length} orphaned file(s):`);
    for (const orphan of allOrphans) {
      console.log(`[cleanup]   ${orphan.kind}/${orphan.filename}`);
    }

    if (DELETE_MODE) {
      console.log("\n[cleanup] Deleting orphaned files...");
      for (const orphan of allOrphans) {
        try {
          await fs.unlink(orphan.resolvedPath);
          console.log(`[cleanup]   Deleted: ${orphan.kind}/${orphan.filename}`);
        } catch (err) {
          console.error(`[cleanup]   Failed to delete ${orphan.kind}/${orphan.filename}: ${err.message}`);
        }
      }
    } else {
      console.log("\n[cleanup] Dry run only — re-run with --delete to actually remove these files.");
    }
  }

  await closePool();
};

run().catch((err) => {
  console.error("[cleanup] Fatal error:", err.message);
  process.exitCode = 1;
});
