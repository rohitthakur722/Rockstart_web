const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
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

describe("GET /api/admin/audit-logs", () => {
  it("rejects a non-admin caller", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.get("/api/admin/audit-logs").set(authHeader());
    expectError(response, 403);
  });

  it("records and lists an entry after an admin mutation, attributing the acting admin", async () => {
    const { agent, authHeader, user: admin } = await registerAndLoginAsAdmin(app);
    const artistResponse = await agent.post("/api/artists").set(authHeader()).send({ name: "Audited Artist" });
    const artistId = artistResponse.body.data.artist.id;

    const response = await agent.get("/api/admin/audit-logs").set(authHeader());
    const data = expectSuccess(response, 200);

    const entry = data.items.find((log) => log.action === "artist_created" && String(log.targetId) === String(artistId));
    expect(entry).toBeDefined();
    expect(entry.admin.id).toBe(admin.id);
  });

  it("paginates results", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    for (let i = 0; i < 3; i += 1) {
      await agent.post("/api/genres").set(authHeader()).send({ name: `Genre ${i}-${Date.now()}-${Math.random()}` });
    }

    const response = await agent.get("/api/admin/audit-logs").set(authHeader()).query({ page: 1, limit: 2 });
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(2);
    expect(data.pagination.limit).toBe(2);
  });

  it("filters by targetType", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    await agent.post("/api/genres").set(authHeader()).send({ name: `Filter Genre ${Date.now()}` });
    await agent.post("/api/artists").set(authHeader()).send({ name: `Filter Artist ${Date.now()}` });

    const response = await agent.get("/api/admin/audit-logs").set(authHeader()).query({ targetType: "genre" });
    const data = expectSuccess(response, 200);
    expect(data.items.every((log) => log.targetType === "genre")).toBe(true);
  });

  it("filters by action", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    await agent.post("/api/genres").set(authHeader()).send({ name: `Action Genre ${Date.now()}` });

    const response = await agent.get("/api/admin/audit-logs").set(authHeader()).query({ action: "genre_created" });
    const data = expectSuccess(response, 200);
    expect(data.items.every((log) => log.action === "genre_created")).toBe(true);
  });

  it("filters by adminUserId", async () => {
    const { agent, authHeader, user: admin } = await registerAndLoginAsAdmin(app);
    await agent.post("/api/genres").set(authHeader()).send({ name: `Admin Filter Genre ${Date.now()}` });

    const response = await agent.get("/api/admin/audit-logs").set(authHeader()).query({ adminUserId: admin.id });
    const data = expectSuccess(response, 200);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((log) => log.admin && log.admin.id === admin.id)).toBe(true);
  });

  it("filters by a fromDate/toDate window", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    await agent.post("/api/genres").set(authHeader()).send({ name: `Dated Genre ${Date.now()}` });

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const withinRange = await agent
      .get("/api/admin/audit-logs")
      .set(authHeader())
      .query({ fromDate: yesterday, toDate: tomorrow });
    expect(expectSuccess(withinRange, 200).items.length).toBeGreaterThan(0);

    const outsideRange = await agent
      .get("/api/admin/audit-logs")
      .set(authHeader())
      .query({ fromDate: tomorrow });
    expect(expectSuccess(outsideRange, 200).items).toHaveLength(0);
  });

  it("ignores an invalid fromDate/toDate instead of erroring", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent
      .get("/api/admin/audit-logs")
      .set(authHeader())
      .query({ fromDate: "not-a-date" });
    expectSuccess(response, 200);
  });
});
