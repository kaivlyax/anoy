const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    getStudyRooms,
    getStudyRoomById,
    createStudyRoom,
    joinStudyRoom,
    leaveStudyRoom,
    deleteStudyRoom
} = require("../controllers/studyRoomController");

// All study room routes require authentication
router.use(protect);

router.get("/", getStudyRooms);
router.post("/", createStudyRoom);
router.get("/:id", getStudyRoomById);
router.post("/:id/join", joinStudyRoom);
router.post("/:id/leave", leaveStudyRoom);
router.delete("/:id", deleteStudyRoom);

module.exports = router;
