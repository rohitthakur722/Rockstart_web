const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { buildValidWavBuffer, buildInvalidAudioBuffer } = require("../helpers/testMedia");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { cleanupTestUploads } = require("../helpers/uploadCleanup");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError } = require("../helpers/apiAssertions");

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

const importAudio = (agent, authHeader, { audio, filename = "my-song.wav", fields = {} } = {}) => {
  let req = agent.post("/api/songs/import").set(authHeader());
  Object.entries(fields).forEach(([key, value]) => {
    req = req.field(key, value);
  });
  return req.attach("audio", audio ?? buildValidWavBuffer(5), filename);
};

describe("POST /api/songs/import", () => {
  it("rejects an unauthenticated import", async () => {
    const response = await request(app)
      .post("/api/songs/import")
      .attach("audio", buildValidWavBuffer(5), "song.wav");
    expectError(response, 401);
  });

  it("imports a valid generated WAV with no metadata fields at all", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader, { filename: "My Cool Track.wav" });

    const data = expectSuccess(response, 201);
    expect(data.duplicate).toBe(false);
    expect(data.song.title).toBe("My Cool Track");
    expect(data.song.artist.name).toBe("Unknown Artist");
    expect(data.song.isPublished).toBe(false);
  });

  it("falls back to filename for title and Unknown Artist when metadata is absent", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader, { filename: "some_song_file.wav" });
    const data = expectSuccess(response, 201);
    expect(data.song.title).toBe("some_song_file");
    expect(data.song.artist.name).toBe("Unknown Artist");
  });

  it("prefers explicitly supplied title and artist over the filename fallback", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader, {
      filename: "ignored-name.wav",
      fields: { title: "Explicit Title", artistName: "Explicit Artist" },
    });
    const data = expectSuccess(response, 201);
    expect(data.song.title).toBe("Explicit Title");
    expect(data.song.artist.name).toBe("Explicit Artist");
  });

  it("imported track remains a draft (is_published = false)", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader);
    const data = expectSuccess(response, 201);
    expect(data.song.isPublished).toBe(false);

    const publicResponse = await request(app).get("/api/songs");
    const publicData = expectSuccess(publicResponse, 200);
    expect(publicData.items.some((s) => s.id === data.song.id)).toBe(false);
  });

  it("imported track appears in the caller's My Uploads with its import source", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const importResponse = await importAudio(agent, authHeader, { filename: "device-track.wav" });
    const importedId = importResponse.body.data.song.id;

    const mineResponse = await agent.get("/api/songs/mine").set(authHeader());
    const mineData = expectSuccess(mineResponse, 200);
    const found = mineData.items.find((s) => s.id === importedId);
    expect(found).toBeDefined();
    expect(found.importSource).toBe("device_import");
    expect(found.originalFileName).toBe("device-track.wav");
  });

  it("detects a duplicate import by the same user and returns the existing song without creating a new row", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const sameAudio = buildValidWavBuffer(7);

    const first = await importAudio(agent, authHeader, { audio: sameAudio, filename: "dup.wav" });
    const firstData = expectSuccess(first, 201);
    expect(firstData.duplicate).toBe(false);

    const second = await importAudio(agent, authHeader, { audio: sameAudio, filename: "dup-again.wav" });
    const secondData = expectSuccess(second, 200);
    expect(secondData.duplicate).toBe(true);
    expect(secondData.song.id).toBe(firstData.song.id);

    const mineResponse = await agent.get("/api/songs/mine").set(authHeader());
    const mineData = expectSuccess(mineResponse, 200);
    expect(mineData.items.filter((s) => s.id === firstData.song.id)).toHaveLength(1);
  });

  it("allows a different user to import the same audio content", async () => {
    const sameAudio = buildValidWavBuffer(6);
    const { agent: agentA, authHeader: headerA } = await registerAndLogin(app);
    const { agent: agentB, authHeader: headerB } = await registerAndLogin(app);

    const responseA = await importAudio(agentA, headerA, { audio: sameAudio, filename: "shared.wav" });
    const responseB = await importAudio(agentB, headerB, { audio: sameAudio, filename: "shared.wav" });

    const dataA = expectSuccess(responseA, 201);
    const dataB = expectSuccess(responseB, 201);
    expect(dataB.duplicate).toBe(false);
    expect(dataB.song.id).not.toBe(dataA.song.id);
  });

  it("rejects a file that is not genuine audio and cleans up", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader, { audio: buildInvalidAudioBuffer() });
    expectError(response, 400);

    const mineResponse = await agent.get("/api/songs/mine").set(authHeader());
    const mineData = expectSuccess(mineResponse, 200);
    expect(mineData.items).toHaveLength(0);
  });

  it("rejects an import with no audio file attached", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.post("/api/songs/import").set(authHeader());
    expectError(response, 400);
  });

  it("ignores any client-supplied isPublished/publication field", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader, {
      fields: { title: "Sneaky", isPublished: "true" },
    });
    const data = expectSuccess(response, 201);
    expect(data.song.isPublished).toBe(false);
  });

  it("does not expose internal filesystem paths in the response", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await importAudio(agent, authHeader);
    const data = expectSuccess(response, 201);
    const serialized = JSON.stringify(data.song);
    expect(serialized).not.toMatch(/\/home\/|\/uploads\/music\/[^"]/);
  });
});
