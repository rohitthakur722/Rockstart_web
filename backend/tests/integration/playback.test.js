const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createPublishedSong, createDraftSong } = require("../helpers/factories");
const { truncateAllTables, closeTestDb } = require("../helpers/database");
const { resetAllRateLimiters } = require("../../middleware/rateLimit.middleware");
const { expectSuccess, expectError, expectValidationErrorOnField } = require("../helpers/apiAssertions");

beforeEach(() => {
  resetAllRateLimiters();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("POST /api/playback/sessions", () => {
  it("starts a session for a published song and reports its qualification threshold", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 60 });

    const response = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const data = expectSuccess(response, 201);
    expect(typeof data.sessionToken).toBe("string");
    expect(data.durationSeconds).toBe(60);
    expect(data.qualificationThresholdSeconds).toBe(15);
  });

  it("rejects starting a session for a draft song", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createDraftSong();

    const response = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    expectError(response, 404);
  });

  it("rejects a missing songId", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.post("/api/playback/sessions").set(authHeader()).send({});
    expectValidationErrorOnField(response, "songId");
  });
});

describe("PATCH /api/playback/sessions/:sessionToken/progress", () => {
  it("does not qualify a play below the threshold", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 60 });

    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    const response = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 5, listenedDeltaSeconds: 5 });
    const data = expectSuccess(response, 200);
    expect(data.qualified).toBe(false);
  });

  it("qualifies a play once the threshold is reached and increments play_count", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 60, playCount: 0 });

    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    const response = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 15, listenedDeltaSeconds: 15 });
    const data = expectSuccess(response, 200);
    expect(data.qualified).toBe(true);

    const detailResponse = await agent.get(`/api/songs/${song.id}`).set(authHeader());
    const detail = expectSuccess(detailResponse, 200);
    expect(detail.song.playCount).toBe(1);
  });

  it("a 3s clip qualifies only once the whole clip is heard", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 3 });

    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken, qualificationThresholdSeconds } = startResponse.body.data;
    expect(qualificationThresholdSeconds).toBe(3);

    const partial = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 2, listenedDeltaSeconds: 2 });
    expect(expectSuccess(partial, 200).qualified).toBe(false);

    const full = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 3, listenedDeltaSeconds: 1 });
    expect(expectSuccess(full, 200).qualified).toBe(true);
  });

  it("rejects progress on another user's session", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 60 });
    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    const { agent: otherAgent, authHeader: otherAuthHeader } = await registerAndLogin(app);
    const response = await otherAgent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(otherAuthHeader())
      .send({ positionSeconds: 5, listenedDeltaSeconds: 5 });
    expectError(response, 404);
  });

  it("rejects an unknown session token", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent
      .patch("/api/playback/sessions/00000000-0000-0000-0000-000000000000/progress")
      .set(authHeader())
      .send({ positionSeconds: 5, listenedDeltaSeconds: 5 });
    expectError(response, 404);
  });

  it("caps a single listenedDeltaSeconds report at 120s regardless of what's claimed", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 600 });
    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    const response = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 500, listenedDeltaSeconds: 99999 });
    const data = expectSuccess(response, 200);
    expect(data.listenedSeconds).toBeLessThanOrEqual(120 + 15);
  });
});

describe("POST /api/playback/sessions/:sessionToken/end", () => {
  it("ends a session and marks it as ended", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 10 });
    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    const response = await agent
      .post(`/api/playback/sessions/${sessionToken}/end`)
      .set(authHeader())
      .send({ positionSeconds: 10, listenedDeltaSeconds: 10, completed: true });
    expectSuccess(response, 200);
  });

  it("rejects further progress once a session has ended", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createPublishedSong({ durationSeconds: 10 });
    const startResponse = await agent.post("/api/playback/sessions").set(authHeader()).send({ songId: song.id });
    const { sessionToken } = startResponse.body.data;

    await agent
      .post(`/api/playback/sessions/${sessionToken}/end`)
      .set(authHeader())
      .send({ positionSeconds: 10, listenedDeltaSeconds: 10, completed: true });

    const response = await agent
      .patch(`/api/playback/sessions/${sessionToken}/progress`)
      .set(authHeader())
      .send({ positionSeconds: 10, listenedDeltaSeconds: 1 });
    expectError(response, 409);
  });
});
