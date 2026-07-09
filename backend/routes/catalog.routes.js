const express = require("express");
const catalogController = require("../controller/catalog.controller");

const router = express.Router();

router.get("/home", catalogController.getHome);

module.exports = router;
