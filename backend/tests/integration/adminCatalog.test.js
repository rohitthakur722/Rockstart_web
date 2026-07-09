const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
const { createPublishedSong, createDraftSong } = require("../helpers/factories");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");
const { buildValidWavBuffer } = require("../helpers/testMedia");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/admin/songs", () => {
  it("rejects a non-admin caller", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.get("/api/admin/songs").set(authHeader());
    expectError(response, 403);
  });

  it("lists both published and draft songs", async () => {
    await createPublishedSong();
    await createDraftSong();

    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.get("/api/admin/songs").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items.some((s) => s.isPublished)).toBe(true);
    expect(data.items.some((s) => !s.isPublished)).toBe(true);
  });

  it("filters by status=draft", async () => {
    await createPublishedSong();
    const draft = await createDraftSong();

    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.get("/api/admin/songs").set(authHeader()).query({ status: "draft" });
    const data = expectSuccess(response, 200);
    expect(data.items.map((s) => s.id)).toEqual([draft.id]);
  });
});

describe("GET /api/admin/songs/:songId", () => {
  it("returns a draft song's detail to an admin", async () => {
    const song = await createDraftSong();
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);

    const response = await agent.get(`/api/admin/songs/${song.id}`).set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.song.id).toBe(song.id);
  });
});

describe("PATCH /api/admin/songs/:songId/publication", () => {
  it("publishes a draft song and records an audit log entry", async () => {
    const song = await createDraftSong();
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);

    const response = await agent
      .patch(`/api/admin/songs/${song.id}/publication`)
      .set(authHeader())
      .send({ isPublished: true });
    const data = expectSuccess(response, 200);
    expect(data.song.isPublished).toBe(true);

    const auditResponse = await agent.get("/api/admin/audit-logs").set(authHeader());
    const auditData = expectSuccess(auditResponse, 200);
    expect(auditData.items.some((log) => log.action === "song_published" && String(log.targetId) === String(song.id))).toBe(true);
  });
});

describe("DELETE /api/admin/songs/:songId", () => {
  it("deletes any song regardless of owner, and records an audit log entry", async () => {
    const { agent: ownerAgent, authHeader: ownerAuthHeader } = await registerAndLogin(app);
    const uploadResponse = await ownerAgent
      .post("/api/songs")
      .set(ownerAuthHeader())
      .field("title", "Admin Deletable")
      .field("artistName", "Someone")
      .attach("audio", buildValidWavBuffer(3), "song.wav");
    const songId = uploadResponse.body.data.song.id;

    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.delete(`/api/admin/songs/${songId}`).set(authHeader());
    expectSuccess(response, 200);

    const auditResponse = await agent.get("/api/admin/audit-logs").set(authHeader());
    const auditData = expectSuccess(auditResponse, 200);
    expect(
      auditData.items.some((log) => log.action === "song_deleted_by_admin" && String(log.targetId) === String(songId))
    ).toBe(true);
  });
});
