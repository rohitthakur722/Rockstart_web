const express = require("express");
const adminCatalogController = require("../controller/adminCatalog.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");
const { adminMutationLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/songs", adminCatalogController.listSongs);
router.get("/songs/:songId", adminCatalogController.getSongDetail);
router.patch("/songs/:songId/publication", adminMutationLimiter, adminCatalogController.setPublication);
router.delete("/songs/:songId", adminMutationLimiter, adminCatalogController.removeSong);

module.exports = router;
