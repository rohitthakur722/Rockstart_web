const request = require("supertest");
const app = require("../../app");
const { registerAndLogin, registerAndLoginAsAdmin } = require("../helpers/auth");
const {
  createArtist,
  createAlbum,
  createGenre,
  createPublishedSong,
  createDraftSong,
} = require("../helpers/factories");
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

describe("GET /api/catalog/home", () => {
  it("returns recentlyAdded, popular, albums, artists, and genres sections", async () => {
    await createPublishedSong();
    const response = await request(app).get("/api/catalog/home");
    const data = expectSuccess(response, 200);
    expect(Array.isArray(data.recentlyAdded)).toBe(true);
    expect(Array.isArray(data.popular)).toBe(true);
    expect(Array.isArray(data.albums)).toBe(true);
    expect(Array.isArray(data.artists)).toBe(true);
    expect(Array.isArray(data.genres)).toBe(true);
  });
});

describe("GET /api/songs (public list)", () => {
  it("only returns published songs", async () => {
    const published = await createPublishedSong({ title: "Published Track" });
    await createDraftSong({ title: "Draft Track" });

    const response = await request(app).get("/api/songs");
    const data = expectSuccess(response, 200);
    const ids = data.items.map((s) => s.id);
    expect(ids).toContain(published.id);
    expect(data.items.every((s) => s.isPublished)).toBe(true);
  });

  it("paginates results", async () => {
    for (let i = 0; i < 5; i += 1) {
      await createPublishedSong();
    }

    const response = await request(app).get("/api/songs").query({ page: 1, limit: 2 });
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(2);
    expect(data.pagination).toMatchObject({ page: 1, limit: 2, totalItems: 5 });
  });

  it("filters by search term", async () => {
    await createPublishedSong({ title: "Zzyzx Unique Title" });
    await createPublishedSong({ title: "Something Else" });

    const response = await request(app).get("/api/songs").query({ search: "Zzyzx" });
    const data = expectSuccess(response, 200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("Zzyzx Unique Title");
  });

  it("filters by artistId", async () => {
    const artist = await createArtist();
    const otherArtist = await createArtist();
    const song = await createPublishedSong({ artistId: artist.id });
    await createPublishedSong({ artistId: otherArtist.id });

    const response = await request(app).get("/api/songs").query({ artistId: artist.id });
    const data = expectSuccess(response, 200);
    expect(data.items.map((s) => s.id)).toEqual([song.id]);
  });
});

describe("GET /api/songs/:songId", () => {
  it("returns a published song to an anonymous viewer", async () => {
    const song = await createPublishedSong();
    const response = await request(app).get(`/api/songs/${song.id}`);
    const data = expectSuccess(response, 200);
    expect(data.song.id).toBe(song.id);
  });

  it("returns 404 for a draft song to an anonymous viewer", async () => {
    const song = await createDraftSong();
    const response = await request(app).get(`/api/songs/${song.id}`);
    expectError(response, 404);
  });

  it("returns a draft song to its owner", async () => {
    const { agent, authHeader, user } = await registerAndLogin(app);
    const song = await createDraftSong({ uploadedBy: user.id });

    const response = await agent.get(`/api/songs/${song.id}`).set(authHeader());
    const data = expectSuccess(response, 200);
    expect(data.song.id).toBe(song.id);
  });

  it("returns 404 for a draft song to a different non-owner user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const song = await createDraftSong();

    const response = await agent.get(`/api/songs/${song.id}`).set(authHeader());
    expectError(response, 404);
  });

  it("returns 404 for a nonexistent song id", async () => {
    const response = await request(app).get("/api/songs/99999999");
    expectError(response, 404);
  });
});

describe("GET /api/artists, /api/albums, /api/genres (public)", () => {
  it("lists artists", async () => {
    await createArtist({ name: "Public Artist" });
    const response = await request(app).get("/api/artists");
    const data = expectSuccess(response, 200);
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("gets an artist's detail", async () => {
    const artist = await createArtist();
    const response = await request(app).get(`/api/artists/${artist.id}`);
    const data = expectSuccess(response, 200);
    expect(data.artist.id).toBe(artist.id);
  });

  it("lists albums", async () => {
    await createAlbum();
    const response = await request(app).get("/api/albums");
    const data = expectSuccess(response, 200);
    expect(data.items.length).toBeGreaterThan(0);
  });

  it("lists genres", async () => {
    await createGenre({ name: "Public Genre" });
    const response = await request(app).get("/api/genres");
    const data = expectSuccess(response, 200);
    expect(data.items.some((g) => g.name === "Public Genre")).toBe(true);
  });
});

describe("Admin CRUD on /api/artists", () => {
  it("rejects creation from an unauthenticated caller", async () => {
    const response = await request(app).post("/api/artists").send({ name: "Nope" });
    expectError(response, 401);
  });

  it("rejects creation from a non-admin user", async () => {
    const { agent, authHeader } = await registerAndLogin(app);
    const response = await agent.post("/api/artists").set(authHeader()).send({ name: "Nope" });
    expectError(response, 403);
  });

  it("allows an admin to create, update, and delete an artist", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);

    const createResponse = await agent.post("/api/artists").set(authHeader()).send({ name: "Admin Created Artist" });
    const created = expectSuccess(createResponse, 201);
    expect(created.artist.name).toBe("Admin Created Artist");

    const updateResponse = await agent
      .patch(`/api/artists/${created.artist.id}`)
      .set(authHeader())
      .send({ name: "Renamed Artist" });
    const updated = expectSuccess(updateResponse, 200);
    expect(updated.artist.name).toBe("Renamed Artist");

    const deleteResponse = await agent.delete(`/api/artists/${created.artist.id}`).set(authHeader());
    expectSuccess(deleteResponse, 200);

    const getResponse = await request(app).get(`/api/artists/${created.artist.id}`);
    expectError(getResponse, 404);
  });

  it("rejects an empty artist name", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent.post("/api/artists").set(authHeader()).send({ name: "" });
    expectValidationErrorOnField(response, "name");
  });
});

describe("Admin CRUD on /api/albums", () => {
  it("allows an admin to create an album under an existing artist", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const artist = await createArtist();

    const response = await agent
      .post("/api/albums")
      .set(authHeader())
      .send({ artistId: artist.id, title: "New Album" });
    const data = expectSuccess(response, 201);
    expect(data.album.title).toBe("New Album");
  });

  it("rejects a non-numeric artistId", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent
      .post("/api/albums")
      .set(authHeader())
      .send({ artistId: "not-a-number", title: "New Album" });
    expectValidationErrorOnField(response, "artistId");
  });

  it("rejects creating an album for a nonexistent artist", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const response = await agent
      .post("/api/albums")
      .set(authHeader())
      .send({ artistId: 99999999, title: "Orphan Album" });
    expectValidationErrorOnField(response, "artistId");
  });

  it("rejects a duplicate album title for the same artist", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const artist = await createArtist();
    await agent.post("/api/albums").set(authHeader()).send({ artistId: artist.id, title: "Same Title" });

    const response = await agent
      .post("/api/albums")
      .set(authHeader())
      .send({ artistId: artist.id, title: "Same Title" });
    expectValidationErrorOnField(response, "title", 409);
  });

  it("gets an album's detail with its published songs", async () => {
    const artist = await createArtist();
    const album = await createAlbum({ artistId: artist.id });
    await createPublishedSong({ artistId: artist.id, albumId: album.id });

    const response = await request(app).get(`/api/albums/${album.id}`);
    const data = expectSuccess(response, 200);
    expect(data.album.id).toBe(album.id);
    expect(data.album.songs).toHaveLength(1);
  });

  it("returns 404 for a nonexistent album", async () => {
    const response = await request(app).get("/api/albums/99999999");
    expectError(response, 404);
  });

  it("updates an album's title and deletes it", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const artist = await createArtist();
    const album = await createAlbum({ artistId: artist.id });

    const updateResponse = await agent
      .patch(`/api/albums/${album.id}`)
      .set(authHeader())
      .send({ title: "Renamed Album" });
    const updated = expectSuccess(updateResponse, 200);
    expect(updated.album.title).toBe("Renamed Album");

    const deleteResponse = await agent.delete(`/api/albums/${album.id}`).set(authHeader());
    expectSuccess(deleteResponse, 200);

    const getResponse = await request(app).get(`/api/albums/${album.id}`);
    expectError(getResponse, 404);
  });

  it("rejects an update with no fields", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);
    const album = await createAlbum();
    const response = await agent.patch(`/api/albums/${album.id}`).set(authHeader()).send({});
    expectValidationErrorOnField(response, "_");
  });
});

describe("Admin CRUD on /api/genres", () => {
  it("allows an admin to create, update, and delete a genre", async () => {
    const { agent, authHeader } = await registerAndLoginAsAdmin(app);

    const createResponse = await agent.post("/api/genres").set(authHeader()).send({ name: "New Genre" });
    const created = expectSuccess(createResponse, 201);

    const updateResponse = await agent
      .patch(`/api/genres/${created.genre.id}`)
      .set(authHeader())
      .send({ name: "Renamed Genre" });
    const updated = expectSuccess(updateResponse, 200);
    expect(updated.genre.name).toBe("Renamed Genre");

    const deleteResponse = await agent.delete(`/api/genres/${created.genre.id}`).set(authHeader());
    expectSuccess(deleteResponse, 200);
  });
});
