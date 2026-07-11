const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createPlaylist, createUser } = require("../helpers/factories");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");
const { query } = require("../../config/db");
const songModel = require("../../model/song.model");
const {
  DEMO_CATALOG,
  runSeed,
  runReset,
  assertNotProduction,
  seedSong,
  resolveOrCreateArtist,
  resolveOrCreateAlbum,
} = require("../../scripts/seedDemoLibrary");

const TOTAL_DEMO_SONGS = DEMO_CATALOG.reduce((sum, group) => sum + group.songs.length, 0);

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("seedDemoLibrary production safety guard", () => {
  it("refuses to run when NODE_ENV=production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() => assertNotProduction("seed")).toThrow(/production/i);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("does not throw when NODE_ENV=test", () => {
    expect(() => assertNotProduction("seed")).not.toThrow();
  });
});

describe("runSeed", () => {
  it("creates the full expected demo catalog as published songs with unique source keys", async () => {
    const summary = await runSeed();
    expect(summary.created).toHaveLength(TOTAL_DEMO_SONGS);
    expect(summary.failed).toHaveLength(0);

    const rows = await query("SELECT id, is_published, source_key, import_source FROM songs WHERE import_source = 'demo_seed'");
    expect(rows.rows).toHaveLength(TOTAL_DEMO_SONGS);
    expect(rows.rows.every((r) => r.is_published === true)).toBe(true);

    const sourceKeys = rows.rows.map((r) => r.source_key);
    expect(new Set(sourceKeys).size).toBe(sourceKeys.length);
  });

  it("is idempotent: rerunning creates no duplicate artists, albums, or songs", async () => {
    await runSeed();

    const [artistsBefore, albumsBefore, songsBefore] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM artists"),
      query("SELECT COUNT(*) AS count FROM albums"),
      query("SELECT COUNT(*) AS count FROM songs WHERE import_source = 'demo_seed'"),
    ]);

    const secondRun = await runSeed();
    expect(secondRun.created).toHaveLength(0);
    expect(secondRun.skipped).toHaveLength(TOTAL_DEMO_SONGS);

    const [artistsAfter, albumsAfter, songsAfter] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM artists"),
      query("SELECT COUNT(*) AS count FROM albums"),
      query("SELECT COUNT(*) AS count FROM songs WHERE import_source = 'demo_seed'"),
    ]);

    expect(artistsAfter.rows[0].count).toBe(artistsBefore.rows[0].count);
    expect(albumsAfter.rows[0].count).toBe(albumsBefore.rows[0].count);
    expect(songsAfter.rows[0].count).toBe(songsBefore.rows[0].count);
  });

  it("reuses an existing genre by case-insensitive name instead of creating a duplicate", async () => {
    await query("INSERT INTO genres (name) VALUES ($1) ON CONFLICT (LOWER(name)) DO NOTHING", ["electronic"]);
    const before = await query("SELECT COUNT(*) AS count FROM genres WHERE LOWER(name) = 'electronic'");
    expect(before.rows[0].count).toBe("1");

    await runSeed();

    const after = await query("SELECT COUNT(*) AS count FROM genres WHERE LOWER(name) = 'electronic'");
    expect(after.rows[0].count).toBe("1");
  });

  it("preserves an existing manually-uploaded song untouched", async () => {
    const owner = await createUser();
    const manualSong = await query(
      `INSERT INTO songs (title, uploaded_by, audio_url, duration_seconds, is_published, import_source)
       VALUES ('My Real Song', $1, '/uploads/music/real.mp3', 180, true, 'manual')
       RETURNING id, updated_at`,
      [owner.id]
    );

    await runSeed();

    const stillThere = await query("SELECT id, title, updated_at FROM songs WHERE id = $1", [manualSong.rows[0].id]);
    expect(stillThere.rows[0].title).toBe("My Real Song");
    expect(stillThere.rows[0].updated_at).toEqual(manualSong.rows[0].updated_at);
  });

  it("cleans up newly generated files when database insertion fails", async () => {
    const fs = require("fs");
    const { MEDIA_DIRS } = require("../../utils/mediaFiles");
    // Compared before/after (not asserted as absolute zero) since the shared
    // test upload root is only cleared at the start/end of the whole Jest
    // run, not between individual test files.
    const musicBefore = fs.readdirSync(MEDIA_DIRS.music).length;
    const coversBefore = fs.readdirSync(MEDIA_DIRS.covers).length;

    const artistRow = await resolveOrCreateArtist("Test Failure Artist");
    const albumRow = await resolveOrCreateAlbum(artistRow.id, "Test Failure Album", { coverUrl: null, releaseDate: null });

    const badSongSpec = {
      key: "unit-test-forced-failure",
      title: "Forced Failure Track",
      trackNumber: 1,
      releaseYear: 2024,
      // A genre name longer than genres.name's VARCHAR(60) triggers a real,
      // unmocked Postgres error partway through the song's transaction.
      genres: ["X".repeat(200)],
      music: { progression: DEMO_CATALOG[0].songs[0].music.progression, bpm: 90, loops: 1, withArpeggio: false, withPercussion: false },
    };

    const result = await seedSong(artistRow, albumRow, badSongSpec);
    expect(result.status).toBe("failed");

    const songRow = await songModel.findBySourceKey("demo:unit-test-forced-failure");
    expect(songRow).toBeNull();

    // The audio + cover written just before the failing insert must have
    // been deleted by the catch block — no net-new files left behind.
    expect(fs.readdirSync(MEDIA_DIRS.music).length).toBe(musicBefore);
    expect(fs.readdirSync(MEDIA_DIRS.covers).length).toBe(coversBefore);
  });
});

describe("Seeded demo songs work through the real API", () => {
  it("stream, catalog listing, likes, and playlists all work for a seeded song", async () => {
    await runSeed();
    const demoSong = await query("SELECT id FROM songs WHERE import_source = 'demo_seed' LIMIT 1");
    const songId = demoSong.rows[0].id;

    const streamResponse = await request(app).get(`/api/songs/${songId}/stream`);
    expect(streamResponse.status).toBe(200);
    expect(Number(streamResponse.headers["content-length"])).toBeGreaterThan(0);

    const rangeResponse = await request(app).get(`/api/songs/${songId}/stream`).set("Range", "bytes=0-999");
    expect(rangeResponse.status).toBe(206);

    const catalogResponse = await request(app).get("/api/songs");
    const catalogData = expectSuccess(catalogResponse, 200);
    expect(catalogData.items.some((s) => String(s.id) === String(songId))).toBe(true);
    expect(catalogData.items.find((s) => String(s.id) === String(songId)).sourceLabel).toBe("RockStar Demo Library");

    const { agent, authHeader, user } = await registerAndLogin(app);
    const likeResponse = await agent.put(`/api/likes/${songId}`).set(authHeader());
    expectSuccess(likeResponse, 200);

    const playlist = await createPlaylist({ userId: user.id });
    const addToPlaylistResponse = await agent
      .post(`/api/playlists/${playlist.id}/songs`)
      .set(authHeader())
      .send({ songId });
    expectSuccess(addToPlaylistResponse, 201);
  });

  it("rejects a request without authentication for likes (sanity check the demo song isn't special-cased)", async () => {
    await runSeed();
    const demoSong = await query("SELECT id FROM songs WHERE import_source = 'demo_seed' LIMIT 1");
    const response = await request(app).put(`/api/likes/${demoSong.rows[0].id}`);
    expectError(response, 401);
  });
});

describe("runReset", () => {
  it("removes only demo_seed songs and preserves manual/device-import content", async () => {
    await runSeed();

    const owner = await createUser();
    await query(
      `INSERT INTO songs (title, uploaded_by, audio_url, duration_seconds, is_published, import_source)
       VALUES ('Manual Survivor', $1, '/uploads/music/survivor.mp3', 120, true, 'manual')`,
      [owner.id]
    );
    await query(
      `INSERT INTO songs (title, uploaded_by, audio_url, duration_seconds, is_published, import_source, content_hash)
       VALUES ('Device Import Survivor', $1, '/uploads/music/device-survivor.wav', 90, false, 'device_import', $2)`,
      [owner.id, "a".repeat(64)]
    );

    const summary = await runReset();
    expect(summary.removedCount).toBe(TOTAL_DEMO_SONGS);

    const remaining = await query("SELECT title, import_source FROM songs ORDER BY title");
    const titles = remaining.rows.map((r) => r.title);
    expect(titles).toContain("Manual Survivor");
    expect(titles).toContain("Device Import Survivor");
    expect(remaining.rows.some((r) => r.import_source === "demo_seed")).toBe(false);

    const usersStillExist = await query("SELECT id FROM users WHERE id = $1", [owner.id]);
    expect(usersStillExist.rows).toHaveLength(1);
  });

  it("is a safe no-op when there is nothing to reset", async () => {
    const summary = await runReset();
    expect(summary.removedCount).toBe(0);
  });
});
