const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createArtist, createPublishedSong, likeSong } = require("../helpers/factories");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/recommendations", () => {
  it("returns songs with a recommendation reason", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    await createPublishedSong();

    const response = await agent.get("/api/recommendations").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(Array.isArray(data.items)).toBe(true);
    if (data.items.length > 0) {
      expect(data.items[0]).toHaveProperty("recommendationReason");
    }
  });

  it("prioritizes songs from an artist the user has liked", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const likedArtist = await createArtist();
    const otherArtist = await createArtist();

    const likedArtistSong = await createPublishedSong({ artistId: likedArtist.id, playCount: 0 });
    const anotherSongBySameArtist = await createPublishedSong({ artistId: likedArtist.id, playCount: 0 });
    await createPublishedSong({ artistId: otherArtist.id, playCount: 0 });

    await likeSong((await agent.get("/api/auth/me").set(authHeader())).body.data.user.id, likedArtistSong.id);

    const response = await agent.get("/api/recommendations").set(authHeader());
    const data = expectSuccess(response, 200);
    const ids = data.items.map((s) => s.id);
    expect(ids).toContain(anotherSongBySameArtist.id);
  });

  it("respects a limit query parameter", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    for (let i = 0; i < 5; i += 1) {
      await createPublishedSong();
    }

    const response = await agent.get("/api/recommendations").set(authHeader()).query({ limit: 2 });
    const data = expectSuccess(response, 200);
    expect(data.items.length).toBeLessThanOrEqual(2);
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/recommendations");
    expectError(response, 401);
  });
});
