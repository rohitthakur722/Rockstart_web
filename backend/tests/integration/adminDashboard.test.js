const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
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

describe("GET /api/admin/dashboard", () => {
  it("rejects a non-admin user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.get("/api/admin/dashboard").set(authHeader());
    expectError(response, 403);
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/admin/dashboard");
    expectError(response, 401);
  });

  it("returns real, current-state platform metrics", async () => {
    await createPublishedSong();
    await createDraftSong();

    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.get("/api/admin/dashboard").set(authHeader());
    const data = expectSuccess(response, 200);

    expect(data.songs.total).toBeGreaterThanOrEqual(2);
    expect(data.songs.published).toBeGreaterThanOrEqual(1);
    expect(data.songs.draft).toBeGreaterThanOrEqual(1);
    expect(data.users.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.recentRegistrations)).toBe(true);
    expect(Array.isArray(data.recentUploads)).toBe(true);
    expect(Array.isArray(data.mostPlayedSongs)).toBe(true);
  });
});
