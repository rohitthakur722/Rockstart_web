const express = require("express");
const artistController = require("../controller/artist.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");
const { adminMutationLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.get("/", artistController.list);
router.get("/:artistId", artistController.getDetail);

router.post("/", authenticate, authorizeRoles("admin"), adminMutationLimiter, artistController.create);
router.patch("/:artistId", authenticate, authorizeRoles("admin"), adminMutationLimiter, artistController.update);
router.delete("/:artistId", authenticate, authorizeRoles("admin"), adminMutationLimiter, artistController.remove);

module.exports = router;
