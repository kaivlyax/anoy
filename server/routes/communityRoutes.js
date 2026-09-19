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
    banCommunityMember,
    unbanCommunityMember,
    getBannedMembers,
    getCommunityMembers,
    getModerationLogs,
    createCommunityReport,
    getCommunityReports,
    resolveCommunityReport,
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

const { requireUnrestricted } = require("../middleware/restrictionMiddleware");

// Public list & read
router.get("/", protect, getCommunities);
router.get("/:slugOrId", protect, getCommunity);
router.get("/:id/members", protect, attachCommunity, getCommunityMembers);
router.get("/:id/boosters", protect, attachCommunity, getBoosters);

// Create community
router.post("/", protect, requireUnrestricted, createCommunity);

// Membership
router.post("/:id/join", protect, attachCommunity, joinCommunity);
router.post("/:id/leave", protect, attachCommunity, leaveCommunity);

// Reports
router.post("/:id/reports", protect, attachCommunity, createCommunityReport);
router.get("/:id/reports", protect, requireCommunityModerator, getCommunityReports);
router.put("/:id/reports/:reportId", protect, requireCommunityModerator, resolveCommunityReport);

// Boost Community (Requires Pro!)
router.post("/:id/boost", protect, requireUnrestricted, requirePro, attachCommunity, boostCommunity);

// Management & Moderation
router.put("/:id", protect, requireCommunityOwner, updateCommunity);
router.post("/:id/moderators", protect, requireCommunityOwner, addModerator);
router.delete("/:id/moderators/:targetUserId", protect, requireCommunityOwner, removeModerator);
router.delete("/:id/members/:targetUserId", protect, requireCommunityModerator, removeMember);
router.post("/:id/members/:targetUserId/ban", protect, requireCommunityModerator, banCommunityMember);
router.post("/:id/members/:targetUserId/unban", protect, requireCommunityModerator, unbanCommunityMember);
router.get("/:id/banned", protect, requireCommunityModerator, getBannedMembers);
router.get("/:id/moderation-logs", protect, requireCommunityModerator, getModerationLogs);

// Community Decorations
router.put("/:id/decorations", protect, requireUnrestricted, requireCommunityOwner, updateCommunityDecorations);
router.post("/:id/decorations/unlock", protect, requireUnrestricted, requireCommunityOwner, unlockCommunityDecoration);

// Community Real-Time Chat & Channels
router.get("/:id/messages", protect, getCommunityMessages);
router.post("/:id/messages", protect, requireUnrestricted, sendCommunityMessage);
router.delete("/:id/messages/:messageId", protect, deleteCommunityMessage);

// Community Meeting Rooms
const meetingRoomRoutes = require("./meetingRoomRoutes");
router.use("/:communityId/meeting-rooms", meetingRoomRoutes);

module.exports = router;
