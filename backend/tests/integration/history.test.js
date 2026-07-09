const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createPublishedSong, createPlaybackHistory } = require("../helpers/factories");
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

describe("GET /api/history/recent", () => {
  it("returns only the caller's qualified plays", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const { user: otherUser } = await registerAndLogin(app);

    const song = await createPublishedSong();
    await createPlaybackHistory({ userId: user.id, songId: song.id, qualifiedAt: new Date() });
    await createPlaybackHistory({ userId: otherUser.id, songId: song.id, qualifiedAt: new Date() });

    const response = await agent.get("/api/history/recent").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(song.id);
  });

  it("excludes unqualified plays", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await createPlaybackHistory({ userId: user.id, songId: song.id, qualifiedAt: null });

    const response = await agent.get("/api/history/recent").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(0);
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/history/recent");
    expectError(response, 401);
  });
});

describe("GET /api/history/stats", () => {
  it("summarizes qualified play counts and listening time", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await createPlaybackHistory({
      userId: user.id,
      songId: song.id,
      qualifiedAt: new Date(),
      listenedSeconds: 30,
    });

    const response = await agent.get("/api/history/stats").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.totalQualifiedPlays).toBe(1);
    expect(data.totalListenedSeconds).toBe(30);
    expect(data.uniqueSongsPlayed).toBe(1);
  });
});

describe("DELETE /api/history", () => {
  it("clears the caller's listening history", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await createPlaybackHistory({ userId: user.id, songId: song.id, qualifiedAt: new Date() });

    const deleteResponse = await agent.delete("/api/history").set(authHeader());
    expectSuccess(deleteResponse, 200);

    const recentResponse = await agent.get("/api/history/recent").set(authHeader());
    const data = expectSuccess(recentResponse, 200);
    expect(data.items).toHaveLength(0);
  });

  it("does not affect another user's history", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const { agent: otherAgent, authHeader: otherAuthHeader, user: otherUser } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await createPlaybackHistory({ userId: user.id, songId: song.id, qualifiedAt: new Date() });
    await createPlaybackHistory({ userId: otherUser.id, songId: song.id, qualifiedAt: new Date() });

    await agent.delete("/api/history").set(authHeader());

    const otherResponse = await otherAgent.get("/api/history/recent").set(otherAuthHeader());
    const data = expectSuccess(otherResponse, 200);
    expect(data.items).toHaveLength(1);
  });
});
