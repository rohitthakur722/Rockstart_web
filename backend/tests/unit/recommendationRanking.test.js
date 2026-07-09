const { rankRecommendations, REASON } = require("../../utils/recommendationRanking");

const makeSong = ({
  id,
  artistId = null,
  albumId = null,
  genreIds = [],
  playCount = 0,
  createdAt = new Date().toISOString(),
} = {}) => ({
  id,
  title: `Song ${id}`,
  artist: artistId != null ? { id: artistId, name: `Artist ${artistId}` } : null,
  album: albumId != null ? { id: albumId, title: `Album ${albumId}` } : null,
  genres: genreIds.map((gid) => ({ id: gid, name: `Genre ${gid}` })),
  playCount,
  createdAt,
});

const emptySignals = () => ({
  likedSongIds: [],
  likedArtistIds: [],
  likedAlbumIds: [],
  likedGenreIds: [],
  recentArtistIds: [],
  recentAlbumIds: [],
  recentlyPlayedSongIds: [],
});

describe("rankRecommendations", () => {
  it("ranks a song from a liked artist above an unrelated song", () => {
    const likedArtistSong = makeSong({ id: 1, artistId: 100 });
    const unrelatedSong = makeSong({ id: 2, artistId: 200 });

    const ranked = rankRecommendations({
      candidates: [unrelatedSong, likedArtistSong],
      signals: { ...emptySignals(), likedArtistIds: [100] },
      limit: 10,
    });

    expect(ranked[0].song.id).toBe(1);
    expect(ranked[0].reason).toBe(REASON.LIKED_ARTIST);
  });

  it("labels a genre-overlap match as based on listening history", () => {
    const genreMatch = makeSong({ id: 1, genreIds: [55] });
    const noMatch = makeSong({ id: 2 });

    const ranked = rankRecommendations({
      candidates: [noMatch, genreMatch],
      signals: { ...emptySignals(), likedGenreIds: [55] },
      limit: 10,
    });

    expect(ranked[0].song.id).toBe(1);
    expect(ranked[0].reason).toBe(REASON.LISTENING_HISTORY);
  });

  it("falls back to the catalog reason with no matching signals", () => {
    const song = makeSong({ id: 1 });
    const ranked = rankRecommendations({ candidates: [song], signals: emptySignals(), limit: 10 });
    expect(ranked[0].reason).toBe(REASON.CATALOG_FALLBACK);
  });

  it("deprioritizes recently played songs below equally-signaled alternatives", () => {
    const recentlyPlayed = makeSong({ id: 1, artistId: 100 });
    const freshFromSameArtist = makeSong({ id: 2, artistId: 100 });

    const ranked = rankRecommendations({
      candidates: [recentlyPlayed, freshFromSameArtist],
      signals: { ...emptySignals(), likedArtistIds: [100], recentlyPlayedSongIds: [1] },
      limit: 10,
    });

    expect(ranked[0].song.id).toBe(2);
  });

  it("still ranks higher-popularity songs above lower-popularity ones with no other signal", () => {
    const popular = makeSong({ id: 1, playCount: 10000 });
    const unpopular = makeSong({ id: 2, playCount: 0 });

    const ranked = rankRecommendations({
      candidates: [unpopular, popular],
      signals: emptySignals(),
      limit: 10,
    });

    expect(ranked[0].song.id).toBe(1);
  });

  it("excludes already-liked songs when enough non-liked candidates remain", () => {
    const liked = makeSong({ id: 1 });
    const notLiked = makeSong({ id: 2 });

    const ranked = rankRecommendations({
      candidates: [liked, notLiked],
      signals: { ...emptySignals(), likedSongIds: [1] },
      limit: 1,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].song.id).toBe(2);
  });

  it("keeps liked songs in the pool when excluding them would leave too few candidates", () => {
    const liked = makeSong({ id: 1 });

    const ranked = rankRecommendations({
      candidates: [liked],
      signals: { ...emptySignals(), likedSongIds: [1] },
      limit: 1,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].song.id).toBe(1);
  });

  it("respects the limit and never returns more than requested", () => {
    const candidates = [1, 2, 3, 4, 5].map((id) => makeSong({ id }));
    const ranked = rankRecommendations({ candidates, signals: emptySignals(), limit: 2 });
    expect(ranked).toHaveLength(2);
  });

  it("never returns duplicate song ids even if a candidate appears twice", () => {
    const song = makeSong({ id: 1 });
    const ranked = rankRecommendations({
      candidates: [song, { ...song }],
      signals: emptySignals(),
      limit: 10,
    });
    expect(ranked).toHaveLength(1);
  });

  it("returns an empty array for an empty candidate pool", () => {
    const ranked = rankRecommendations({ candidates: [], signals: emptySignals(), limit: 10 });
    expect(ranked).toEqual([]);
  });
});
