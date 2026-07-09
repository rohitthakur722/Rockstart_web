const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createPublishedSong, createDraftSong } = require("../helpers/factories");
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

describe("PUT /api/likes/:songId", () => {
  it("likes a published song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong();

    const response = await agent.put(`/api/likes/${song.id}`).set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data).toEqual({ songId: String(song.id), liked: true });
  });

  it("rejects liking a draft song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createDraftSong();

    const response = await agent.put(`/api/likes/${song.id}`).set(authHeader());
    expectError(response, 404);
  });

  it("rejects liking a nonexistent song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.put("/api/likes/99999999").set(authHeader());
    expectError(response, 404);
  });

  it("is idempotent when liking the same song twice", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong();

    await agent.put(`/api/likes/${song.id}`).set(authHeader());
    const second = await agent.put(`/api/likes/${song.id}`).set(authHeader());
    expectSuccess(second, 200);
  });

  it("rejects an unauthenticated request", async () => {
    const song = await createPublishedSong();
    const response = await request(app).put(`/api/likes/${song.id}`);
    expectError(response, 401);
  });
});

describe("DELETE /api/likes/:songId", () => {
  it("unlikes a previously-liked song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong();

    await agent.put(`/api/likes/${song.id}`).set(authHeader());
    const response = await agent.delete(`/api/likes/${song.id}`).set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data).toEqual({ songId: String(song.id), liked: false });
  });

  it("is idempotent when unliking a song that was never liked", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong();

    const response = await agent.delete(`/api/likes/${song.id}`).set(authHeader());
    expectSuccess(response, 200);
  });
});

describe("GET /api/likes and /api/likes/ids", () => {
  it("lists liked songs with pagination and only the caller's own likes", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const { agent: otherAgent, authHeader: otherAuthHeader } = await registerAndLogin(app);

    const song1 = await createPublishedSong({ title: "Liked By Me" });
    const song2 = await createPublishedSong({ title: "Liked By Other" });

    await agent.put(`/api/likes/${song1.id}`).set(authHeader());
    await otherAgent.put(`/api/likes/${song2.id}`).set(otherAuthHeader());

    const response = await agent.get("/api/likes").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(song1.id);
    expect(data.items[0].liked).toBe(true);
  });

  it("lists liked song ids as strings", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await agent.put(`/api/likes/${song.id}`).set(authHeader());

    const response = await agent.get("/api/likes/ids").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.songIds).toEqual([String(song.id)]);
  });
});
