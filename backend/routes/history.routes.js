const express = require("express");
const historyController = require("../controller/history.controller");
const authenticate = require("../middleware/authenticate.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/recent", historyController.recent);
router.get("/stats", historyController.stats);
router.delete("/", historyController.clear);

module.exports = router;
