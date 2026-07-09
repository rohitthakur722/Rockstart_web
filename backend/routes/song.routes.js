const express = require("express");
const songController = require("../controller/song.controller");
const authenticate = require("../middleware/authenticate.middleware");
const optionalAuthenticate = require("../middleware/optionalAuthenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");
const uploadErrorMiddleware = require("../middleware/uploadError.middleware");
const { createUploader, createSongUploader } = require("../utils/uploadConfig");
const { uploadLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();
const uploadSong = createSongUploader();
const uploadSongCover = createUploader("covers").single("cover");

router.get("/", optionalAuthenticate, songController.listPublic);
router.get("/mine", authenticate, songController.listMine);
router.post("/", authenticate, uploadLimiter, uploadSong, uploadErrorMiddleware, songController.create);

router.get("/:songId", optionalAuthenticate, songController.getDetail);
router.get("/:songId/stream", optionalAuthenticate, songController.stream);
router.patch("/:songId", authenticate, songController.update);
router.patch(
  "/:songId/cover",
  authenticate,
  uploadLimiter,
  uploadSongCover,
  uploadErrorMiddleware,
  songController.replaceCover
);
router.patch("/:songId/publication", authenticate, authorizeRoles("admin"), songController.setPublication);
router.delete("/:songId", authenticate, songController.remove);

module.exports = router;
