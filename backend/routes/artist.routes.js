const express = require("express");
const artistController = require("../controller/artist.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");

const router = express.Router();

router.get("/", artistController.list);
router.get("/:artistId", artistController.getDetail);

router.post("/", authenticate, authorizeRoles("admin"), artistController.create);
router.patch("/:artistId", authenticate, authorizeRoles("admin"), artistController.update);
router.delete("/:artistId", authenticate, authorizeRoles("admin"), artistController.remove);

module.exports = router;
