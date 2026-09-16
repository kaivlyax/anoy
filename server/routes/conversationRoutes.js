const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
    getUserConversations,
    getOrCreateConversation,
    getConversationMessages,
    sendMessage,
    deleteMessage,
    getUnreadMessagesCount
} = require("../controllers/conversationController");

const router = express.Router();

// All conversation routes require JWT authentication
router.use(protect);

// Global unread messages counter (must be before :id routes)
router.get("/unread-count", getUnreadMessagesCount);

// Conversation list and creation
router.get("/", getUserConversations);
router.post("/", getOrCreateConversation);

// Messages in a conversation
router.get("/:id/messages", getConversationMessages);
router.post("/:id/messages", sendMessage);
router.delete("/:id/messages/:messageId", deleteMessage);

module.exports = router;
