const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const aiRateLimiter = require("../middleware/aiRateLimiter");
const {
    chat,
    getConversations,
    getConversationMessages,
    deleteConversation
} = require("../controllers/aiController");

// Chat endpoint protected by JWT auth and rate limiter
router.post("/chat", protect, aiRateLimiter, chat);

// Conversation management
router.get("/conversations", protect, getConversations);
router.get("/conversations/:id/messages", protect, getConversationMessages);
router.delete("/conversations/:id", protect, deleteConversation);

module.exports = router;
