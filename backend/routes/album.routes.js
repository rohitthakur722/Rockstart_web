const express = require("express");
const albumController = require("../controller/album.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");

const router = express.Router();

router.get("/", albumController.list);
router.get("/:albumId", albumController.getDetail);

router.post("/", authenticate, authorizeRoles("admin"), albumController.create);
router.patch("/:albumId", authenticate, authorizeRoles("admin"), albumController.update);
router.delete("/:albumId", authenticate, authorizeRoles("admin"), albumController.remove);

module.exports = router;
