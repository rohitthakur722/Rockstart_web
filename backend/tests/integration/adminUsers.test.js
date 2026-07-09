const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");
const adminUserService = require("../../service/adminUser.service");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/admin/users", () => {
  it("rejects a non-admin caller", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.get("/api/admin/users").set(authHeader());
    expectError(response, 403);
  });

  it("lists users with pagination", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    await registerAndLogin(app);
    await registerAndLogin(app);

    const response = await agent.get("/api/admin/users").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    expect(data.items[0]).not.toHaveProperty("passwordHash");
  });

  it("gets a single user's detail", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const { user: target } = await registerAndLogin(app);

    const response = await agent.get(`/api/admin/users/${target.id}`).set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.user.id).toBe(target.id);
  });

  it("returns 404 for a nonexistent user", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.get("/api/admin/users/99999999").set(authHeader());
    expectError(response, 404);
  });
});

describe("PATCH /api/admin/users/:userId/role", () => {
  it("promotes a user to admin", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const { user: target } = await registerAndLogin(app);

    const response = await agent
      .patch(`/api/admin/users/${target.id}/role`)
      .set(authHeader())
      .send({ role: "admin" });
    const data = expectSuccess(response, 200);
    expect(data.user.role).toBe("admin");
  });

  it("rejects an invalid role value", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const { user: target } = await registerAndLogin(app);

    const response = await agent
      .patch(`/api/admin/users/${target.id}/role`)
      .set(authHeader())
      .send({ role: "superadmin" });
    expectError(response, 400);
  });

  it("rejects an admin changing their own role", async () => {
    const { agent, authHeader, user } = await registerAndLoginAsAdmin(app);

    const response = await agent
      .patch(`/api/admin/users/${user.id}/role`)
      .set(authHeader())
      .send({ role: "user" });
    expectError(response, 403);
  });

  it("demotes an admin to user when other admins remain, revoking their sessions", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const targetAdmin = await registerAndLoginAsAdmin(app);

    const response = await agent
      .patch(`/api/admin/users/${targetAdmin.user.id}/role`)
      .set(authHeader())
      .send({ role: "user" });
    const data = expectSuccess(response, 200);
    expect(data.user.role).toBe("user");

    // The demoted user's existing refresh session should now be dead.
    const refreshResponse = await targetAdmin.agent.post("/api/auth/refresh");
    expectError(refreshResponse, 401);
  });
});

describe("PATCH /api/admin/users/:userId/status", () => {
  it("suspends and reactivates a user", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const { user: target } = await registerAndLogin(app);

    const suspendResponse = await agent
      .patch(`/api/admin/users/${target.id}/status`)
      .set(authHeader())
      .send({ isActive: false });
    const suspended = expectSuccess(suspendResponse, 200);
    expect(suspended.user.isActive).toBe(false);

    const reactivateResponse = await agent
      .patch(`/api/admin/users/${target.id}/status`)
      .set(authHeader())
      .send({ isActive: true });
    const reactivated = expectSuccess(reactivateResponse, 200);
    expect(reactivated.user.isActive).toBe(true);
  });

  it("rejects an admin suspending their own account", async () => {
    const { agent, authHeader, user } = await registerAndLoginAsAdmin(app);
    const response = await agent
      .patch(`/api/admin/users/${user.id}/status`)
      .set(authHeader())
      .send({ isActive: false });
    expectError(response, 403);
  });

  it("suspending a user revokes their active sessions", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const target = await registerAndLogin(app);

    await agent.patch(`/api/admin/users/${target.user.id}/status`).set(authHeader()).send({ isActive: false });

    const refreshResponse = await target.agent.post("/api/auth/refresh");
    expectError(refreshResponse, 401);
  });

  it("rejects a suspended user logging in", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const target = await registerAndLogin(app);
    await agent.patch(`/api/admin/users/${target.user.id}/status`).set(authHeader()).send({ isActive: false });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: target.user.email, password: target.password });
    expectError(loginResponse, 403);
  });
});

// The "don't remove the last active administrator" guard is defense-in-depth
// inside adminUser.service.js — it is not reachable through a single serial
// HTTP request: authorizeRoles("admin") requires the *acting* admin to
// currently be active, and self-action is blocked separately, so the acting
// admin is always still counted among the survivors after any one request.
// It only matters for a genuine concurrent-request race or a future caller
// that doesn't go through those two HTTP-level guards — so it's exercised
// directly against the real database here, at the service layer.
describe("adminUser.service last-active-administrator protection", () => {
  it("rejects changeRole when it would leave zero active administrators", async () => {
    const { user: soleAdmin } = await registerAndLoginAsAdmin(app);
    const differentActor = { id: soleAdmin.id + 999999 };

    await expect(adminUserService.changeRole(differentActor, soleAdmin.id, "user")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects changeStatus (suspend) when it would leave zero active administrators", async () => {
    const { user: soleAdmin } = await registerAndLoginAsAdmin(app);
    const differentActor = { id: soleAdmin.id + 999999 };

    await expect(adminUserService.changeStatus(differentActor, soleAdmin.id, false)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("still allows demoting an admin when a second active admin exists", async () => {
    const { user: adminA } = await registerAndLoginAsAdmin(app);
    const { user: adminB } = await registerAndLoginAsAdmin(app);

    const result = await adminUserService.changeRole({ id: adminB.id }, adminA.id, "user");
    expect(result.user.role).toBe("user");
  });
});
