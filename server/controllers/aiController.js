const mongoose = require("mongoose");
const AIConversation = require("../models/AIConversation");
const AIMessage = require("../models/AIMessage");
const { generateAssistantResponse } = require("../services/aiService");

/**
 * Handle AI Chat Message
 * POST /api/v1/ai/chat
 */
const chat = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { message, conversationId } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message text is required"
            });
        }

        const trimmedMessage = message.trim();
        if (trimmedMessage.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Message exceeds maximum allowed length of 1000 characters"
            });
        }

        // Locate or create conversation session
        let conversation = null;
        if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
            conversation = await AIConversation.findOne({ _id: conversationId, user: userId });
        }

        if (!conversation) {
            const titleSnippet = trimmedMessage.length > 40 ? `${trimmedMessage.slice(0, 37)}...` : trimmedMessage;
            conversation = await AIConversation.create({
                user: userId,
                title: titleSnippet,
                lastMessageAt: new Date()
            });
        }

        // Fetch recent bounded message history (last 6 turns)
        const recentMessages = await AIMessage.find({ conversation: conversation._id })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();

        const conversationHistory = recentMessages.reverse().map((m) => ({
            role: m.role,
            content: m.content
        }));

        // Execute AI generation with controlled tools & security boundaries
        const aiResult = await generateAssistantResponse({
            message: trimmedMessage,
            conversationHistory,
            currentUserId: userId
        });

        // Persist User turn
        await AIMessage.create({
            conversation: conversation._id,
            user: userId,
            role: "user",
            content: trimmedMessage
        });

        // Persist Assistant turn
        await AIMessage.create({
            conversation: conversation._id,
            user: userId,
            role: "assistant",
            content: aiResult.content,
            sources: aiResult.sources || []
        });

        // Update conversation timestamp
        conversation.lastMessageAt = new Date();
        await conversation.save();

        return res.status(200).json({
            success: true,
            conversationId: conversation._id,
            message: aiResult.content,
            sources: aiResult.sources || []
        });
    } catch (error) {
        console.error("AI chat error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process AI assistant request. Please try again."
        });
    }
};

/**
 * Get User's Past AI Conversation Sessions
 * GET /api/v1/ai/conversations
 */
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;
        const conversations = await AIConversation.find({ user: userId })
            .sort({ lastMessageAt: -1 })
            .limit(30)
            .lean();

        return res.status(200).json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error("getConversations error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching conversations" });
    }
};

/**
 * Get Messages for a Specific AI Conversation Session
 * GET /api/v1/ai/conversations/:id/messages
 */
const getConversationMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await AIConversation.findOne({ _id: id, user: userId });
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation session not found" });
        }

        const messages = await AIMessage.find({ conversation: id })
            .sort({ createdAt: 1 })
            .limit(50)
            .lean();

        return res.status(200).json({
            success: true,
            conversation,
            messages
        });
    } catch (error) {
        console.error("getConversationMessages error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching messages" });
    }
};

/**
 * Delete an AI Conversation Session
 * DELETE /api/v1/ai/conversations/:id
 */
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await AIConversation.findOneAndDelete({ _id: id, user: userId });
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        await AIMessage.deleteMany({ conversation: id });

        return res.status(200).json({
            success: true,
            message: "Conversation deleted successfully"
        });
    } catch (error) {
        console.error("deleteConversation error:", error);
        return res.status(500).json({ success: false, message: "Server error deleting conversation" });
    }
};

module.exports = {
    chat,
    getConversations,
    getConversationMessages,
    deleteConversation
};
