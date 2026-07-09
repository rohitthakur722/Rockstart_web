const express = require("express");
const adminAuditController = require("../controller/adminAudit.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", adminAuditController.list);

module.exports = router;
