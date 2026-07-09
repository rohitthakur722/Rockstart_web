const express = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const songRoutes = require("./song.routes");
const artistRoutes = require("./artist.routes");
const albumRoutes = require("./album.routes");
const genreRoutes = require("./genre.routes");
const catalogRoutes = require("./catalog.routes");
const likeRoutes = require("./like.routes");
const playlistRoutes = require("./playlist.routes");
const playbackRoutes = require("./playback.routes");
const historyRoutes = require("./history.routes");
const recommendationRoutes = require("./recommendation.routes");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Rockstar API",
    data: { version: "1.0.0-phase4" },
  });
});

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/songs", songRoutes);
router.use("/artists", artistRoutes);
router.use("/albums", albumRoutes);
router.use("/genres", genreRoutes);
router.use("/catalog", catalogRoutes);
router.use("/likes", likeRoutes);
router.use("/playlists", playlistRoutes);
router.use("/playback", playbackRoutes);
router.use("/history", historyRoutes);
router.use("/recommendations", recommendationRoutes);

module.exports = router;
