const express = require("express");
const adminUserController = require("../controller/adminUser.controller");
const authenticate = require("../middleware/authenticate.middleware");
const authorizeRoles = require("../middleware/authorize.middleware");
const { adminMutationLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", adminUserController.list);
router.get("/:userId", adminUserController.getDetail);
router.patch("/:userId/role", adminMutationLimiter, adminUserController.changeRole);
router.patch("/:userId/status", adminMutationLimiter, adminUserController.changeStatus);

module.exports = router;
