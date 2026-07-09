const express = require("express");
const userController = require("../controller/user.controller");
const authenticate = require("../middleware/authenticate.middleware");
const uploadErrorMiddleware = require("../middleware/uploadError.middleware");
const { createUploader } = require("../utils/uploadConfig");
const { uploadLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();
const uploadAvatar = createUploader("profiles").single("avatar");

router.use(authenticate);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/avatar", uploadLimiter, uploadAvatar, uploadErrorMiddleware, userController.updateAvatar);
router.patch("/me/password", userController.changePassword);

router.get("/me/preferences", userController.getPreferences);
router.patch("/me/preferences", userController.updatePreferences);

router.get("/me/sessions", userController.listSessions);
router.delete("/me/sessions/:sessionId", userController.revokeSession);
router.post("/me/sessions/revoke-others", userController.revokeOtherSessions);

router.get("/me/export", userController.exportData);

module.exports = router;
