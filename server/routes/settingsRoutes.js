const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    getSettings,
    changePassword,
    updatePrivacy,
    updateNotifications,
    getBlockedUsers,
    blockUser,
    unblockUser,
    logoutAllDevices,
    deleteAccount
} = require("../controllers/settingsController");

// All settings routes require authentication
router.use(protect);

// Account and preferences
router.get("/", getSettings);
router.post("/change-password", changePassword);
router.put("/privacy", updatePrivacy);
router.put("/notifications", updateNotifications);

// Block management
router.get("/blocked", getBlockedUsers);
router.post("/block/:username", blockUser);
router.post("/unblock/:username", unblockUser);

// Security & Sessions
router.post("/logout-all", logoutAllDevices);

// Danger zone
router.post("/delete-account", deleteAccount);

module.exports = router;
