const express = require("express");
const playbackController = require("../controller/playback.controller");
const authenticate = require("../middleware/authenticate.middleware");

const router = express.Router();

router.use(authenticate);

router.post("/sessions", playbackController.createSession);
router.patch("/sessions/:sessionToken/progress", playbackController.progress);
router.post("/sessions/:sessionToken/end", playbackController.end);

module.exports = router;
