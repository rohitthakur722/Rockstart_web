const express = require("express");
const likeController = require("../controller/like.controller");
const authenticate = require("../middleware/authenticate.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", likeController.list);
router.get("/ids", likeController.listIds);
router.put("/:songId", likeController.like);
router.delete("/:songId", likeController.unlike);

module.exports = router;
