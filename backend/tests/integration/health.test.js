const request = require("supertest");
const app = require("../../app");
const { closeTestDb } = require("../helpers/database");
const { expectSuccess } = require("../helpers/apiAssertions");

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/", () => {
  it("returns the API name and version", async () => {
    const response = await request(app).get("/api/");
    const data = expectSuccess(response, 200);
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("phase");
  });
});

describe("GET /api/health", () => {
  it("reports a healthy, connected database", async () => {
    const response = await request(app).get("/api/health");
    const data = expectSuccess(response, 200);
    expect(data.database).toBe("connected");
    expect(data.environment).toBe("test");
  });
});

describe("unknown routes", () => {
  it("returns a 404 JSON error for an unmatched API route", async () => {
    const response = await request(app).get("/api/this-route-does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false });
  });
});
