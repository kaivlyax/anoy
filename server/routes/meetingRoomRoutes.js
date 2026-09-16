const express = require("express");
const router = express.Router({ mergeParams: true });
const auth = require("../middleware/authMiddleware");
const {
    getCommunityMeetingRooms,
    createMeetingRoom,
    getMeetingRoom,
    joinMeetingRoom,
    leaveMeetingRoom,
    deleteMeetingRoom
} = require("../controllers/meetingRoomController");

// Community Meeting Rooms listing and creation
router.get("/", auth, getCommunityMeetingRooms);
router.post("/", auth, createMeetingRoom);

// Single Meeting Room operations
router.get("/:id", auth, getMeetingRoom);
router.post("/:id/join", auth, joinMeetingRoom);
router.post("/:id/leave", auth, leaveMeetingRoom);
router.delete("/:id", auth, deleteMeetingRoom);

module.exports = router;
