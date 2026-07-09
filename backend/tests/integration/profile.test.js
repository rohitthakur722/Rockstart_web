const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { buildValidPngBuffer, buildInvalidImageBuffer } = require("../helpers/testMedia");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { expectSuccess, expectError, expectValidationErrorOnField } = require("../helpers/apiAssertions");
const { cleanupTestUploads } = require("../helpers/uploadCleanup");
const { createPlaylist, createPublishedSong, likeSong } = require("../helpers/factories");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
  await cleanupTestUploads();
});

afterAll(async () => {
  await closeTestDb();
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user's profile without a password hash", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);

    const response = await agent.get("/api/auth/me").set(authHeader());

    const data = expectSuccess(response, 200);
    expect(data.user.id).toBe(user.id);
    expect(data.user).not.toHaveProperty("password_hash");
    expect(data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a request with no Authorization header", async () => {
    const response = await request(app).get("/api/auth/me");
    expectError(response, 401);
  });
});

describe("PATCH /api/users/me", () => {
  it("updates the profile's full name and username", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent
      .patch("/api/users/me")
      .set(authHeader())
      .send({ fullName: "Updated Name", username: "updated_username" });

    const data = expectSuccess(response, 200);
    expect(data.user.fullName).toBe("Updated Name");
    expect(data.user.username).toBe("updated_username");
  });

  it("rejects an invalid username", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent
      .patch("/api/users/me")
      .set(authHeader())
      .send({ username: "not valid!" });

    expectValidationErrorOnField(response, "username");
  });

  it("rejects an update with no fields", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.patch("/api/users/me").set(authHeader()).send({});
    expectValidationErrorOnField(response, "_");
  });

  it("rejects taking a username that is already in use by another account", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const { user: otherUser } = await registerAndLogin(app);

    const response = await agent.patch("/api/users/me").set(authHeader()).send({ username: otherUser.username });
    expectValidationErrorOnField(response, "username", 409);
  });
});

describe("PATCH /api/users/me/password", () => {
  it("changes the password, revokes existing sessions, and requires a fresh login", async () => {
    const { agent, authHeader, password: oldPassword, user } = await registerAndLogin(app);
    const newPassword = "BrandNewPassword456";

    const response = await agent
      .patch("/api/users/me/password")
      .set(authHeader())
      .send({ currentPassword: oldPassword, newPassword, confirmPassword: newPassword });
    expectSuccess(response, 200);

    const oldLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: oldPassword });
    expectError(oldLogin, 401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: user.email, password: newPassword });
    expectSuccess(newLogin, 200);
  });

  it("rejects an incorrect current password", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent
      .patch("/api/users/me/password")
      .set(authHeader())
      .send({ currentPassword: "TotallyWrongPass1", newPassword: "AnotherNewPass123", confirmPassword: "AnotherNewPass123" });
    expectError(response, 401);
  });

  it("rejects a new password identical to the current one", async () => {
    const { agent, authHeader, password } = await registerAndLogin(app);
    const response = await agent
      .patch("/api/users/me/password")
      .set(authHeader())
      .send({ currentPassword: password, newPassword: password, confirmPassword: password });
    expectValidationErrorOnField(response, "newPassword");
  });

  it("rejects mismatched confirmPassword", async () => {
    const { agent, authHeader, password } = await registerAndLogin(app);
    const response = await agent
      .patch("/api/users/me/password")
      .set(authHeader())
      .send({ currentPassword: password, newPassword: "SomeNewPassword123", confirmPassword: "Different123" });
    expectValidationErrorOnField(response, "confirmPassword");
  });
});

describe("PATCH /api/users/me/avatar", () => {
  it("stores the uploaded avatar and serves it back at the returned URL", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const uploadResponse = await agent
      .patch("/api/users/me/avatar")
      .set(authHeader())
      .attach("avatar", buildValidPngBuffer(), "avatar.png");

    const data = expectSuccess(uploadResponse, 200);
    expect(data.user.avatarUrl).toMatch(/^\/uploads\/profiles\/.+\.png$/);

    // The static middleware must serve the file from wherever it was
    // actually written (the test upload root under NODE_ENV=test) — not a
    // hardcoded real uploads/ path that would never contain it.
    const fileResponse = await request(app).get(data.user.avatarUrl);
    expect(fileResponse.status).toBe(200);
  });

  it("rejects a file that is not a genuine image", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent
      .patch("/api/users/me/avatar")
      .set(authHeader())
      .attach("avatar", buildInvalidImageBuffer(), "avatar.png");

    expectError(response, 400);
  });

  it("rejects a request with no file attached", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent.patch("/api/users/me/avatar").set(authHeader());
    expectError(response, 400);
  });
});

describe("GET/PATCH /api/users/me/preferences", () => {
  it("returns default preferences for a new user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const response = await agent.get("/api/users/me/preferences").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.preferences.theme).toBe("system");
  });

  it("updates preferences and persists the change", async () => {
    const { agent, authHeader } = await registerAndLogin(app);

    const updateResponse = await agent
      .patch("/api/users/me/preferences")
      .set(authHeader())
      .send({ theme: "dark", reduceMotion: true });

    const updated = expectSuccess(updateResponse, 200);
    expect(updated.preferences.theme).toBe("dark");
    expect(updated.preferences.reduceMotion).toBe(true);

    const getResponse = await agent.get("/api/users/me/preferences").set(authHeader());
    const fetched = expectSuccess(getResponse, 200);
    expect(fetched.preferences.theme).toBe("dark");
  });
});

describe("GET /api/users/me/export", () => {
  it("exports the user's own data without other users' records", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const song = await createPublishedSong();
    await likeSong(user.id, song.id);
    await createPlaylist({ userId: user.id, name: "My Export Playlist" });

    const response = await agent.get("/api/users/me/export").set(authHeader());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.headers["content-disposition"]).toMatch(/attachment/);

    const payload = JSON.parse(response.text);
    expect(payload.profile.id).toBe(user.id);
    expect(payload.profile).not.toHaveProperty("password_hash");
    expect(payload.likedSongIds).toContain(song.id);
    expect(payload.playlists.some((p) => p.name === "My Export Playlist")).toBe(true);
  });

  it("rejects an unauthenticated export request", async () => {
    const response = await request(app).get("/api/users/me/export");
    expectError(response, 401);
  });
});
