const request = require("supertest");
const app = require("../../app");
const { registerAndLogin } = require("../helpers/auth");
const { createPlaylist, createPublishedSong, createDraftSong } = require("../helpers/factories");
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

describe("POST /api/playlists", () => {
  it("creates a playlist for the caller", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.post("/api/playlists").set(authHeader()).send({ name: "My Playlist" });
    const data = expectSuccess(response, 201);
    expect(data.playlist.name).toBe("My Playlist");
    expect(data.playlist.songs).toEqual([]);
  });

  it("rejects a blank name", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.post("/api/playlists").set(authHeader()).send({ name: "  " });
    expectValidationErrorOnField(response, "name");
  });

  it("rejects a duplicate playlist name (case-insensitive) for the same user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    await agent.post("/api/playlists").set(authHeader()).send({ name: "Focus" });

    const response = await agent.post("/api/playlists").set(authHeader()).send({ name: "focus" });
    expectValidationErrorOnField(response, "name", 409);
  });

  it("allows two different users to have the same playlist name", async () => {
    const { agent: agentA, authHeader: headerA } = await registerAndLogin(app);
    const { agent: agentB, authHeader: headerB } = await registerAndLogin(app);

    await agentA.post("/api/playlists").set(headerA()).send({ name: "Shared Name" });
    const response = await agentB.post("/api/playlists").set(headerB()).send({ name: "Shared Name" });
    expectSuccess(response, 201);
  });
});

describe("GET /api/playlists and /api/playlists/:id", () => {
  it("lists only the caller's own playlists", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const { user: otherUser } = await registerAndLogin(app);

    await createPlaylist({ userId: user.id, name: "Mine" });
    await createPlaylist({ userId: otherUser.id, name: "Not Mine" });

    const response = await agent.get("/api/playlists").set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.playlists).toHaveLength(1);
    expect(data.playlists[0].name).toBe("Mine");
  });

  it("returns 404 for another user's playlist", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const { user: otherUser } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: otherUser.id });

    const response = await agent.get(`/api/playlists/${playlist.id}`).set(authHeader());
    expectError(response, 404);
  });
});

describe("PATCH /api/playlists/:id", () => {
  it("updates the playlist's name and description", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });

    const response = await agent
      .patch(`/api/playlists/${playlist.id}`)
      .set(authHeader())
      .send({ name: "Renamed", description: "New description" });
    const data = expectSuccess(response, 200);
    expect(data.playlist.name).toBe("Renamed");
    expect(data.playlist.description).toBe("New description");
  });
});

describe("DELETE /api/playlists/:id", () => {
  it("deletes the caller's own playlist", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });

    const response = await agent.delete(`/api/playlists/${playlist.id}`).set(authHeader());
    expectSuccess(response, 200);

    const getResponse = await agent.get(`/api/playlists/${playlist.id}`).set(authHeader());
    expectError(getResponse, 404);
  });

  it("rejects deleting another user's playlist", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const { user: otherUser } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: otherUser.id });

    const response = await agent.delete(`/api/playlists/${playlist.id}`).set(authHeader());
    expectError(response, 404);
  });
});

describe("POST /api/playlists/:id/songs and DELETE /api/playlists/:id/songs/:songId", () => {
  it("adds a published song to the playlist", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const song = await createPublishedSong();

    const response = await agent
      .post(`/api/playlists/${playlist.id}/songs`)
      .set(authHeader())
      .send({ songId: song.id });
    const data = expectSuccess(response, 201);
    expect(data.playlist.songs).toHaveLength(1);
    expect(data.playlist.songs[0].id).toBe(song.id);
    expect(data.playlist.songs[0].position).toBe(0);
  });

  it("rejects adding a draft (unpublished) song", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const song = await createDraftSong();

    const response = await agent
      .post(`/api/playlists/${playlist.id}/songs`)
      .set(authHeader())
      .send({ songId: song.id });
    expectError(response, 404);
  });

  it("rejects adding the same song twice", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const song = await createPublishedSong();

    await agent.post(`/api/playlists/${playlist.id}/songs`).set(authHeader()).send({ songId: song.id });
    const response = await agent
      .post(`/api/playlists/${playlist.id}/songs`)
      .set(authHeader())
      .send({ songId: song.id });
    expectError(response, 409);
  });

  it("removes a song from the playlist", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const song = await createPublishedSong();
    await agent.post(`/api/playlists/${playlist.id}/songs`).set(authHeader()).send({ songId: song.id });

    const response = await agent
      .delete(`/api/playlists/${playlist.id}/songs/${song.id}`)
      .set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.playlist.songs).toHaveLength(0);
  });
});

describe("PATCH /api/playlists/:id/order", () => {
  it("reorders songs to the given order", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const songA = await createPublishedSong();
    const songB = await createPublishedSong();
    const songC = await createPublishedSong();

    for (const song of [songA, songB, songC]) {
      await agent.post(`/api/playlists/${playlist.id}/songs`).set(authHeader()).send({ songId: song.id });
    }

    const response = await agent
      .patch(`/api/playlists/${playlist.id}/order`)
      .set(authHeader())
      .send({ songIds: [String(songC.id), String(songA.id), String(songB.id)] });

    const data = expectSuccess(response, 200);
    expect(data.playlist.songs.map((s) => s.id)).toEqual([songC.id, songA.id, songB.id]);
  });

  it("rejects a reorder that omits an existing song", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });
    const songA = await createPublishedSong();
    const songB = await createPublishedSong();

    await agent.post(`/api/playlists/${playlist.id}/songs`).set(authHeader()).send({ songId: songA.id });
    await agent.post(`/api/playlists/${playlist.id}/songs`).set(authHeader()).send({ songId: songB.id });

    const response = await agent
      .patch(`/api/playlists/${playlist.id}/order`)
      .set(authHeader())
      .send({ songIds: [String(songA.id)] });
    expectError(response, 400);
  });

  it("rejects an empty songIds array", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const playlist = await createPlaylist({ userId: user.id });

    const response = await agent
      .patch(`/api/playlists/${playlist.id}/order`)
      .set(authHeader())
      .send({ songIds: [] });
    expectValidationErrorOnField(response, "songIds");
  });
});
