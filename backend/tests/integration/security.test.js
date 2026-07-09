const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, buildRegistrationPayload } = require("../helpers/auth");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectError } = require("../helpers/apiAssertions");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("Security headers", () => {
  it("sends Helmet security headers on every response", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows the configured client origin with credentials", async () => {
    const response = await request(app).get("/api/health").set("Origin", process.env.CLIENT_URL);
    expect(response.headers["access-control-allow-origin"]).toBe(process.env.CLIENT_URL);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("handles a CORS preflight request", async () => {
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", process.env.CLIENT_URL)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");
    expect(response.status).toBeLessThan(400);
    expect(response.headers["access-control-allow-origin"]).toBe(process.env.CLIENT_URL);
  });

  it("does not reflect an arbitrary, unconfigured origin", async () => {
    const response = await request(app).get("/api/health").set("Origin", "https://evil-example.test");
    expect(response.headers["access-control-allow-origin"]).not.toBe("https://evil-example.test");
  });
});

describe("Rate limiting", () => {
  it("returns 429 with the standard error shape once the auth limiter is exceeded", async () => {
    const requests = [];
    for (let i = 0; i < 11; i += 1) {
      requests.push(
        request(app)
          .post("/api/auth/login")
          .send({ email: "nobody@example.test", password: "WrongPassword123" })
      );
    }
    const responses = await Promise.all(requests);
    const limited = responses.find((r) => r.status === 429);
    expect(limited).toBeDefined();
    expect(limited.body).toEqual({
      success: false,
      message: "Too many requests. Please slow down and try again shortly.",
      errors: [],
    });
  });

  it("exposes standard RateLimit-* headers", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.test", password: "WrongPassword123" });
    expect(response.headers).toHaveProperty("ratelimit-limit");
    expect(response.headers).toHaveProperty("ratelimit-remaining");
  });
});

describe("Error response shape", () => {
  it("returns {success:false, message} for a 404", async () => {
    const response = await request(app).get("/api/not-a-real-route");
    const body = expectError(response, 404);
    expect(body).toHaveProperty("message");
  });

  it("returns a validation error with a field-level errors array", async () => {
    const response = await request(app).post("/api/auth/register").send({});
    const body = expectError(response, 400);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0]).toHaveProperty("field");
    expect(body.errors[0]).toHaveProperty("message");
  });

  it("returns 400 for malformed JSON in the request body", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{ not valid json");
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });
});

describe("Cookie security attributes", () => {
  it("sets the refresh cookie as HttpOnly with a restricted path", async () => {
    const payload = buildRegistrationPayload();
    const response = await request(app).post("/api/auth/register").send(payload);
    const setCookie = (response.headers["set-cookie"] || []).find((c) =>
      c.startsWith(`${process.env.REFRESH_COOKIE_NAME}=`)
    );
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\/api/i);
  });

  it("never returns the access token or password in a Set-Cookie header", async () => {
    const payload = buildRegistrationPayload();
    const response = await request(app).post("/api/auth/register").send(payload);
    const cookies = (response.headers["set-cookie"] || []).join(";");
    expect(cookies).not.toContain(payload.password);
  });
});
