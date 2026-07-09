const request = require("supertest");
const app = require("../../app");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { registerAndLogin, buildRegistrationPayload } = require("../helpers/auth");
const { createUser } = require("../helpers/factories");
const {
  expectSuccess,
  expectError,
  expectValidationErrorOnField,
  expectNoPasswordHash,
} = require("../helpers/apiAssertions");

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME;

beforeEach(async () => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

const extractCookieValue = (response, cookieName) => {
  const setCookieHeaders = response.headers["set-cookie"] || [];
  const match = setCookieHeaders.find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return null;
  return match.split(";")[0].split("=").slice(1).join("=");
};

describe("POST /api/auth/register", () => {
  it("creates an account and returns a user, access token, and refresh cookie", async () => {
    const payload = buildRegistrationPayload();
    const response = await request(app).post("/api/auth/register").send(payload);

    const data = expectSuccess(response, 201);
    expect(data.user.email).toBe(payload.email);
    expect(typeof data.accessToken).toBe("string");
    expectNoPasswordHash(data.user);

    const cookieValue = extractCookieValue(response, REFRESH_COOKIE_NAME);
    expect(cookieValue).toBeTruthy();
  });

  it("rejects a duplicate email", async () => {
    const payload = buildRegistrationPayload();
    await request(app).post("/api/auth/register").send(payload);

    const second = await request(app)
      .post("/api/auth/register")
      .send(buildRegistrationPayload({ email: payload.email }));

    expectValidationErrorOnField(second, "email", 409);
  });

  it("rejects a duplicate username", async () => {
    const payload = buildRegistrationPayload();
    await request(app).post("/api/auth/register").send(payload);

    const second = await request(app)
      .post("/api/auth/register")
      .send(buildRegistrationPayload({ username: payload.username }));

    expectValidationErrorOnField(second, "username", 409);
  });

  it("rejects a weak password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(buildRegistrationPayload({ password: "alllowercase" }));
    expectValidationErrorOnField(response, "password");
  });

  it("rejects mismatched confirmPassword", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(buildRegistrationPayload({ confirmPassword: "SomethingElse123" }));
    expectValidationErrorOnField(response, "confirmPassword");
  });

  it("rejects an invalid username", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(buildRegistrationPayload({ username: "not valid!" }));
    expectValidationErrorOnField(response, "username");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { password, user } = await registerAndLogin(app);

    const response = await request(app).post("/api/auth/login").send({ email: user.email, password });
    const data = expectSuccess(response, 200);
    expect(data.user.id).toBe(user.id);
    expect(typeof data.accessToken).toBe("string");
  });

  it("rejects an incorrect password with a generic message", async () => {
    const { user } = await registerAndLogin(app);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "TotallyWrongPass1" });

    const body = expectError(response, 401);
    expect(body.message).toBe("Invalid email or password.");
  });

  it("rejects a nonexistent email with the same generic message", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody-here@example.test", password: "SomePassword123" });

    const body = expectError(response, 401);
    expect(body.message).toBe("Invalid email or password.");
  });

  it("rejects login for a deactivated account", async () => {
    const user = await createUser({ isActive: false });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    expectError(response, 403);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new access token and rotates the refresh cookie", async () => {
    const { agent } = await registerAndLogin(app);

    const response = await agent.post("/api/auth/refresh");
    const data = expectSuccess(response, 200);
    expect(typeof data.accessToken).toBe("string");

    const newCookie = extractCookieValue(response, REFRESH_COOKIE_NAME);
    expect(newCookie).toBeTruthy();
  });

  it("rejects a refresh with no cookie present", async () => {
    const response = await request(app).post("/api/auth/refresh");
    expectError(response, 401);
  });

  it("detects reuse of a rotated (already-refreshed) token and revokes the whole session", async () => {
    const payload = buildRegistrationPayload();
    const registerResponse = await request(app).post("/api/auth/register").send(payload);
    const originalRefreshCookie = extractCookieValue(registerResponse, REFRESH_COOKIE_NAME);
    expect(originalRefreshCookie).toBeTruthy();

    // First refresh with the original cookie rotates it successfully.
    const firstRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${originalRefreshCookie}`);
    expectSuccess(firstRefresh, 200);
    const rotatedRefreshCookie = extractCookieValue(firstRefresh, REFRESH_COOKIE_NAME);
    expect(rotatedRefreshCookie).toBeTruthy();
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    // Replaying the ORIGINAL (now-rotated-away) cookie is treated as a theft signal.
    const reuseResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${originalRefreshCookie}`);
    expectError(reuseResponse, 401);

    // The reuse should have revoked every session for the user — even the
    // legitimately-rotated cookie from the first refresh must now be dead.
    const followUpRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${rotatedRefreshCookie}`);
    expectError(followUpRefresh, 401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the refresh cookie and invalidates the session", async () => {
    const payload = buildRegistrationPayload();
    const registerResponse = await request(app).post("/api/auth/register").send(payload);
    const refreshCookie = extractCookieValue(registerResponse, REFRESH_COOKIE_NAME);

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
    expectSuccess(logoutResponse, 200);

    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${REFRESH_COOKIE_NAME}=${refreshCookie}`);
    expectError(refreshAfterLogout, 401);
  });

  it("is safe to call with no refresh cookie present", async () => {
    const response = await request(app).post("/api/auth/logout");
    expectSuccess(response, 200);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid access token", async () => {
    const { authHeader, user } = await registerAndLogin(app);
    const response = await request(app).get("/api/auth/me").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.user.id).toBe(user.id);
  });

  it("rejects a malformed Authorization header", async () => {
    const response = await request(app).get("/api/auth/me").set("Authorization", "not-a-bearer-token");
    expectError(response, 401);
  });

  it("rejects a syntactically valid but bogus token", async () => {
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer not.a.real.jwt");
    expectError(response, 401);
  });
});

describe("POST /api/auth/forgot-password + POST /api/auth/reset-password", () => {
  it("returns a dev reset link for an existing account under NODE_ENV=test", async () => {
    const { user } = await registerAndLogin(app);

    const response = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const data = expectSuccess(response, 200);
    expect(data.devResetUrl).toEqual(expect.stringContaining("token="));
  });

  it("does not reveal whether an email exists", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody-at-all@example.test" });
    const data = expectSuccess(response, 200);
    expect(data).toBeNull();
  });

  it("resets the password with a valid token and invalidates old sessions", async () => {
    const { user, password: oldPassword } = await registerAndLogin(app);

    const forgotResponse = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const { devResetUrl } = expectSuccess(forgotResponse, 200);
    const token = new URL(devResetUrl).searchParams.get("token");

    const newPassword = "BrandNewPassword123";
    const resetResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: newPassword, confirmPassword: newPassword });
    expectSuccess(resetResponse, 200);

    const oldLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: oldPassword });
    expectError(oldLoginResponse, 401);

    const newLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: newPassword });
    expectSuccess(newLoginResponse, 200);
  });

  it("rejects an invalid or already-used reset token", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "SomePassword123", confirmPassword: "SomePassword123" });
    expectError(response, 400);
  });
});
