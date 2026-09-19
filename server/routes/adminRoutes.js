const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const {
    listUsers,
    getUserById,
    getUserConversations,
    banUser,
    unbanUser,
    restrictUser,
    unrestrictUser,
    reviewPrivateMessages,
    getAuditLogs
} = require("../controllers/adminController");

// All admin routes strictly require JWT authentication + platform ADMIN role
router.use(protect, requireAdmin);

// User management
router.get("/users", listUsers);
router.get("/users/:id", getUserById);
router.get("/users/:id/conversations", getUserConversations);
router.post("/users/:id/ban", banUser);
router.post("/users/:id/unban", unbanUser);
router.post("/users/:id/restrict", restrictUser);
router.post("/users/:id/unrestrict", unrestrictUser);

// Private message review with mandatory reason & audit log
router.get("/conversations/:id/messages", reviewPrivateMessages);
router.post("/conversations/:id/review", reviewPrivateMessages);

// Audit logs
router.get("/audit-logs", getAuditLogs);

module.exports = router;
