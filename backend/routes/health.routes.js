const express = require("express");
const healthController = require("../controller/health.controller");

const router = express.Router();

router.get("/", healthController.getHealth);

module.exports = router;
