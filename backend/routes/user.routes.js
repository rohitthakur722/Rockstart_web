const express = require("express");
const userController = require("../controller/user.controller");
const authenticate = require("../middleware/authenticate.middleware");
const uploadErrorMiddleware = require("../middleware/uploadError.middleware");
const { createUploader } = require("../utils/uploadConfig");

const router = express.Router();
const uploadAvatar = createUploader("profiles").single("avatar");

router.use(authenticate);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/avatar", uploadAvatar, uploadErrorMiddleware, userController.updateAvatar);
router.patch("/me/password", userController.changePassword);

module.exports = router;
