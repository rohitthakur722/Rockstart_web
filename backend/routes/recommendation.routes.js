const express = require("express");
const recommendationController = require("../controller/recommendation.controller");
const authenticate = require("../middleware/authenticate.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", recommendationController.list);

module.exports = router;
