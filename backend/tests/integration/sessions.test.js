const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, buildRegistrationPayload } = require("../helpers/auth");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME;

const extractCookieValue = (response, cookieName) => {
  const setCookieHeaders = response.headers["set-cookie"] || [];
  const match = setCookieHeaders.find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return null;
  return match.split(";")[0].split("=").slice(1).join("=");
};

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/users/me/sessions", () => {
  it("lists the current session and marks it isCurrent", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent.get("/api/users/me/sessions").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].isCurrent).toBe(true);
  });

  it("lists multiple sessions after logging in again from another client", async () => {
    const payload = buildRegistrationPayload();
    await request(app).post("/api/auth/register").send(payload);

    const login1 = await request(app).post("/api/auth/login").send({ email: payload.email, password: payload.password });
    const login2 = await request(app).post("/api/auth/login").send({ email: payload.email, password: payload.password });

    const token = login2.body.data.accessToken;
    const response = await request(app)
      .get("/api/users/me/sessions")
      .set("Authorization", `Bearer ${token}`);

    const data = expectSuccess(response, 200);

    expect(data.sessions.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/users/me/sessions");
    expectError(response, 401);
  });
});

describe("DELETE /api/users/me/sessions/:sessionId", () => {
  it("revokes a specific session so its refresh token can no longer be used", async () => {
    const payload = buildRegistrationPayload();
    const registerResponse = await request(app).post("/api/auth/register").send(payload);
    const refreshCookie = extractCookieValue(registerResponse, REFRESH_COOKIE_NAME);
    const accessToken = registerResponse.body.data.accessToken;

    const listResponse = await request(app)
      .get("/api/users/me/sessions")
      .set("Authorization", `Bearer ${accessToken}`);
    const sessionId = listResponse.body.data.sessions[0].id;

    const revokeResponse = await request(app)
      .delete(`/api/users/me/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expectSuccess(revokeResponse, 200);

    const refreshAfterRevoke = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
    expectError(refreshAfterRevoke, 401);
  });

  it("is idempotent when revoking a session that does not belong to the caller", async () => {
    const { authHeader } = await registerAndLogin(app);
    const response = await request(app)
      .delete("/api/users/me/sessions/99999999")
      .set(authHeader());
    expectSuccess(response, 200);
  });
});

describe("POST /api/users/me/sessions/revoke-others", () => {
  it("revokes every session except the current one", async () => {
    const payload = buildRegistrationPayload();
    const registerResponse = await request(app).post("/api/auth/register").send(payload);
    const firstRefreshCookie = extractCookieValue(registerResponse, REFRESH_COOKIE_NAME);

    const secondLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });
    const secondRefreshCookie = extractCookieValue(secondLogin, REFRESH_COOKIE_NAME);
    const secondAccessToken = secondLogin.body.data.accessToken;

    const revokeResponse = await request(app)
      .post("/api/users/me/sessions/revoke-others")
      .set("Authorization", `Bearer ${secondAccessToken}`)
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${secondRefreshCookie}`);
    const data = expectSuccess(revokeResponse, 200);
    expect(data.revokedCount).toBeGreaterThanOrEqual(1);

    const firstRefreshAfter = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${firstRefreshCookie}`);
    expectError(firstRefreshAfter, 401);

    const secondRefreshAfter = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${secondRefreshCookie}`);
    expectSuccess(secondRefreshAfter, 200);
  });

  it("rejects revoke-others when no refresh cookie is present on the request", async () => {
    const { authHeader } = await registerAndLogin(app);
    const response = await request(app)
      .post("/api/users/me/sessions/revoke-others")
      .set(authHeader());
    expectError(response, 401);
  });
});
