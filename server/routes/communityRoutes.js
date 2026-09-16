const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { requirePro } = require("../middleware/premiumMiddleware");
const {
    attachCommunity,
    requireCommunityOwner,
    requireCommunityModerator
} = require("../middleware/communityMiddleware");
const {
    getCommunities,
    getCommunity,
    createCommunity,
    updateCommunity,
    joinCommunity,
    leaveCommunity,
    addModerator,
    removeModerator,
    removeMember,
    boostCommunity,
    getBoosters,
    updateCommunityDecorations,
    unlockCommunityDecoration
} = require("../controllers/communityController");
const {
    getCommunityMessages,
    sendCommunityMessage,
    deleteCommunityMessage
} = require("../controllers/communityChatController");

// Public list & read
router.get("/", protect, getCommunities);
router.get("/:slugOrId", protect, getCommunity);
router.get("/:id/boosters", protect, attachCommunity, getBoosters);

// Create community
router.post("/", protect, createCommunity);

// Membership
router.post("/:id/join", protect, attachCommunity, joinCommunity);
router.post("/:id/leave", protect, attachCommunity, leaveCommunity);

// Boost Community (Requires Pro!)
router.post("/:id/boost", protect, requirePro, attachCommunity, boostCommunity);

// Management & Moderation
router.put("/:id", protect, requireCommunityOwner, updateCommunity);
router.post("/:id/moderators", protect, requireCommunityOwner, addModerator);
router.delete("/:id/moderators/:targetUserId", protect, requireCommunityOwner, removeModerator);
router.delete("/:id/members/:targetUserId", protect, requireCommunityModerator, removeMember);

// Community Decorations
router.put("/:id/decorations", protect, requireCommunityOwner, updateCommunityDecorations);
router.post("/:id/decorations/unlock", protect, requireCommunityOwner, unlockCommunityDecoration);

// Community Real-Time Chat & Channels
router.get("/:id/messages", protect, getCommunityMessages);
router.post("/:id/messages", protect, sendCommunityMessage);
router.delete("/:id/messages/:messageId", protect, deleteCommunityMessage);

// Community Meeting Rooms
const meetingRoomRoutes = require("./meetingRoomRoutes");
router.use("/:communityId/meeting-rooms", meetingRoomRoutes);

module.exports = router;
