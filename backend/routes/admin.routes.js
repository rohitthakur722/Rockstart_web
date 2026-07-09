const express = require("express");
const adminController = require("../controller/admin.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/dashboard", adminController.getDashboard);

module.exports = router;
