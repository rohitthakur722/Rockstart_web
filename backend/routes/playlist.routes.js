const express = require("express");
const playlistController = require("../controller/playlist.controller");
const authenticate = require("../middleware/authenticate.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", playlistController.list);
router.post("/", playlistController.create);
router.get("/:playlistId", playlistController.getOne);
router.patch("/:playlistId", playlistController.update);
router.delete("/:playlistId", playlistController.remove);
router.patch("/:playlistId/order", playlistController.reorder);
router.post("/:playlistId/songs", playlistController.addSong);
router.delete("/:playlistId/songs/:songId", playlistController.removeSong);

module.exports = router;
