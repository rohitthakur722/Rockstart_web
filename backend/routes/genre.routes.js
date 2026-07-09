const express = require("express");
const genreController = require("../controller/genre.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");

const router = express.Router();

router.get("/", genreController.list);

router.post("/", authenticate, authorizeRoles("admin"), genreController.create);
router.patch("/:genreId", authenticate, authorizeRoles("admin"), genreController.update);
router.delete("/:genreId", authenticate, authorizeRoles("admin"), genreController.remove);

module.exports = router;
