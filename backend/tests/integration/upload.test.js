const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
const {
  buildValidWavBuffer,
  buildInvalidAudioBuffer,
  buildValidPngBuffer,
  buildInvalidImageBuffer,
} = require("../helpers/testMedia");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { cleanupTestUploads } = require("../helpers/uploadCleanup");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { createGenre } = require("../helpers/factories");
const { expectSuccess, expectError, expectValidationErrorOnField } = require("../helpers/apiAssertions");

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

const uploadSong = (agent, authHeader, { title = "My Song", artistName = "My Artist", audio, cover } = {}) => {
  let req = agent
    .post("/api/songs")
    .set(authHeader())
    .field("title", title)
    .field("artistName", artistName)
    .attach("audio", audio ?? buildValidWavBuffer(5), "song.wav");
  if (cover) req = req.attach("cover", cover, "cover.png");
  return req;
};

describe("POST /api/songs", () => {
  it("uploads a song with a real WAV file and derives its duration", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await uploadSong(agent, authHeader, { audio: buildValidWavBuffer(20) });

    const data = expectSuccess(response, 201);
    expect(data.song.title).toBe("My Song");
    expect(data.song.artist.name).toBe("My Artist");
    expect(data.song.durationSeconds).toBe(20);
    expect(data.song.isPublished).toBe(false);
  });

  it("uploads a song with a cover image", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await uploadSong(agent, authHeader, { cover: buildValidPngBuffer() });

    const data = expectSuccess(response, 201);
    expect(data.song.coverUrl).toMatch(/^\/uploads\/covers\/.+\.png$/);
  });

  it("rejects a request with no audio file", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent
      .post("/api/songs")
      .set(authHeader())
      .field("title", "No Audio")
      .field("artistName", "Someone");
    expectError(response, 400);
  });

  it("rejects an audio file that is not genuine audio", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await uploadSong(agent, authHeader, { audio: buildInvalidAudioBuffer() });
    expectError(response, 400);
  });

  it("rejects an invalid cover image and does not create the song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await uploadSong(agent, authHeader, { cover: buildInvalidImageBuffer() });
    expectError(response, 400);

    const mineResponse = await agent.get("/api/songs/mine").set(authHeader());
    const mine = expectSuccess(mineResponse, 200);
    expect(mine.items).toHaveLength(0);
  });

  it("rejects a missing artistName", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent
      .post("/api/songs")
      .set(authHeader())
      .field("title", "No Artist")
      .attach("audio", buildValidWavBuffer(5), "song.wav");
    expectValidationErrorOnField(response, "artistName");
  });

  it("rejects an unauthenticated upload", async () => {
    const response = await request(app)
      .post("/api/songs")
      .field("title", "Nope")
      .field("artistName", "Nope")
      .attach("audio", buildValidWavBuffer(5), "song.wav");
    expectError(response, 401);
  });
});

describe("GET /api/songs/mine", () => {
  it("lists only the caller's own uploads, including drafts", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const { agent: otherAgent, authHeader: otherAuthHeader } = await registerAndLogin(app);

    await uploadSong(agent, authHeader, { title: "Mine" });
    await uploadSong(otherAgent, otherAuthHeader, { title: "Not Mine" });

    const response = await agent.get("/api/songs/mine").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("Mine");
  });
});

describe("PATCH /api/songs/:songId", () => {
  it("lets the owner update metadata", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}`)
      .set(authHeader())
      .send({ title: "Updated Title" });
    const data = expectSuccess(response, 200);
    expect(data.song.title).toBe("Updated Title");
  });

  it("rejects an update from a non-owner, non-admin user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const { agent: otherAgent, authHeader: otherAuthHeader } = await registerAndLogin(app);
    const response = await otherAgent
      .patch(`/api/songs/${songId}`)
      .set(otherAuthHeader())
      .send({ title: "Hijacked" });
    expectError(response, 403);
  });

  it("allows an admin to update someone else's song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const { agent: adminAgent, authHeader: adminAuthHeader } = await registerAndLoginAsAdmin(app);
    const response = await adminAgent
      .patch(`/api/songs/${songId}`)
      .set(adminAuthHeader())
      .send({ title: "Admin Edited" });
    expectSuccess(response, 200);
  });

  it("updates album, track number, release year, and genres together", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;
    const genre = await createGenre();

    const response = await agent
      .patch(`/api/songs/${songId}`)
      .set(authHeader())
      .send({ albumTitle: "New Album Title", trackNumber: 4, releaseYear: 2020, genreIds: [String(genre.id)] });
    const data = expectSuccess(response, 200);
    expect(data.song.album.title).toBe("New Album Title");
    expect(data.song.trackNumber).toBe(4);
    expect(data.song.releaseYear).toBe(2020);
    expect(data.song.genres.map((g) => String(g.id))).toEqual([String(genre.id)]);
  });

  it("rejects an unknown genre id on update", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}`)
      .set(authHeader())
      .send({ genreIds: ["99999999"] });
    expectError(response, 400);
  });

  it("rejects an update with no fields at all", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent.patch(`/api/songs/${songId}`).set(authHeader()).send({});
    expectValidationErrorOnField(response, "_");
  });

  it("rejects an out-of-range release year", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}`)
      .set(authHeader())
      .send({ releaseYear: 1800 });
    expectValidationErrorOnField(response, "releaseYear");
  });

  it("rejects a negative track number", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}`)
      .set(authHeader())
      .send({ trackNumber: -1 });
    expectValidationErrorOnField(response, "trackNumber");
  });

  it("returns 404 when updating a nonexistent song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent
      .patch("/api/songs/99999999")
      .set(authHeader())
      .send({ title: "Nope" });
    expectError(response, 404);
  });
});

describe("PATCH /api/songs/:songId/cover", () => {
  it("lets the owner replace the cover with a valid image", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}/cover`)
      .set(authHeader())
      .attach("cover", buildValidPngBuffer(), "new-cover.png");
    const data = expectSuccess(response, 200);
    expect(data.song.coverUrl).toMatch(/^\/uploads\/covers\/.+\.png$/);
  });

  it("rejects an invalid cover image", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}/cover`)
      .set(authHeader())
      .attach("cover", buildInvalidImageBuffer(), "new-cover.png");
    expectError(response, 400);
  });
});

describe("PATCH /api/songs/:songId/publication", () => {
  it("requires admin", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .patch(`/api/songs/${songId}/publication`)
      .set(authHeader())
      .send({ isPublished: true });
    expectError(response, 403);
  });

  it("lets an admin publish a draft song, making it visible publicly", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const { agent: adminAgent, authHeader: adminAuthHeader } = await registerAndLoginAsAdmin(app);
    const publishResponse = await adminAgent
      .patch(`/api/songs/${songId}/publication`)
      .set(adminAuthHeader())
      .send({ isPublished: true });
    expectSuccess(publishResponse, 200);

    const publicResponse = await request(app).get(`/api/songs/${songId}`);
    const data = expectSuccess(publicResponse, 200);
    expect(data.song.isPublished).toBe(true);
  });
});

describe("DELETE /api/songs/:songId", () => {
  it("lets the owner delete their own song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await agent.delete(`/api/songs/${songId}`).set(authHeader());
    expectSuccess(response, 200);

    const getResponse = await agent.get(`/api/songs/${songId}`).set(authHeader());
    expectError(getResponse, 404);
  });

  it("rejects deletion by a non-owner, non-admin user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const { agent: otherAgent, authHeader: otherAuthHeader } = await registerAndLogin(app);
    const response = await otherAgent.delete(`/api/songs/${songId}`).set(otherAuthHeader());
    expectError(response, 403);
  });
});

describe("GET /api/songs/:songId/stream", () => {
  it("streams the full file with a 200 and Accept-Ranges header", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader, { audio: buildValidWavBuffer(5) });
    const songId = uploadResponse.body.data.song.id;

    const response = await agent.get(`/api/songs/${songId}/stream`).set(authHeader());
    expect(response.status).toBe(200);
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(Number(response.headers["content-length"])).toBeGreaterThan(0);
  });

  it("serves a partial range with 206 and a Content-Range header", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader, { audio: buildValidWavBuffer(5) });
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .get(`/api/songs/${songId}/stream`)
      .set(authHeader())
      .set("Range", "bytes=0-99");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toMatch(/^bytes 0-99\//);
    expect(Number(response.headers["content-length"])).toBe(100);
  });

  it("returns 416 for an unsatisfiable range", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader, { audio: buildValidWavBuffer(1) });
    const songId = uploadResponse.body.data.song.id;

    const response = await agent
      .get(`/api/songs/${songId}/stream`)
      .set(authHeader())
      .set("Range", "bytes=999999999-9999999999");
    expect(response.status).toBe(416);
  });

  it("blocks streaming a draft song for a non-owner, non-admin viewer", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const uploadResponse = await uploadSong(agent, authHeader);
    const songId = uploadResponse.body.data.song.id;

    const response = await request(app).get(`/api/songs/${songId}/stream`);
    expectError(response, 404);
  });
});
