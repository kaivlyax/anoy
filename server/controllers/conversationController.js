const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Block = require("../models/Block");
const Follow = require("../models/Follow");

// Helper to attach Profile data (displayName, avatar, isPro, avatarDecoration) to populated participants
const enrichConversationParticipants = async (conversations) => {
    if (!conversations || conversations.length === 0) return [];

    const userIds = new Set();
    conversations.forEach((conv) => {
        conv.participants?.forEach((p) => {
            if (p && (p._id || p)) {
                userIds.add((p._id || p).toString());
            }
        });
    });

    const profiles = await Profile.find({
        userId: { $in: Array.from(userIds) }
    }).select("userId username displayName avatar bio isPro avatarDecoration");

    const profileMap = new Map();
    profiles.forEach((prof) => {
        profileMap.set(prof.userId.toString(), prof);
    });

    return conversations.map((conv) => {
        const convObj = conv.toObject ? conv.toObject() : conv;
        convObj.participants = convObj.participants.map((p) => {
            const pId = (p._id || p).toString();
            const prof = profileMap.get(pId);
            return {
                _id: p._id || p,
                username: p.username || prof?.username || "",
                displayName: prof?.displayName || p.username || "",
                avatar: prof?.avatar || "",
                bio: prof?.bio || "",
                isPro: prof?.isPro || false,
                avatarDecoration: prof?.avatarDecoration || ""
            };
        });
        return convObj;
    });
};

// =====================================================
// GET USER CONVERSATIONS
// =====================================================
const getUserConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate("participants", "username")
            .populate({
                path: "lastMessage",
                populate: { path: "sender", select: "username" }
            })
            .sort({ lastMessageAt: -1 });

        const enriched = await enrichConversationParticipants(conversations);

        const conversationsWithUnread = await Promise.all(
            enriched.map(async (conv) => {
                const unreadCount = await Message.countDocuments({
                    conversation: conv._id,
                    sender: { $ne: req.user._id },
                    read: false,
                    isDeleted: false
                });
                return {
                    ...conv,
                    unreadCount
                };
            })
        );

        return res.status(200).json({
            success: true,
            count: conversationsWithUnread.length,
            conversations: conversationsWithUnread
        });
    } catch (error) {
        console.error("Get user conversations error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving conversations"
        });
    }
};

// =====================================================
// GET OR CREATE CONVERSATION (1-to-1)
// =====================================================
const getOrCreateConversation = async (req, res) => {
    try {
        const { recipientId, username } = req.body;

        if (!recipientId && !username) {
            return res.status(400).json({
                success: false,
                message: "Recipient ID or username is required"
            });
        }

        let recipient;
        if (recipientId) {
            if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid recipient ID format"
                });
            }
            recipient = await Identity.findById(recipientId);
        } else if (username) {
            recipient = await Identity.findOne({
                username: username.toLowerCase().trim()
            });
        }

        if (!recipient || recipient.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "Recipient user not found"
            });
        }

        if (recipient._id.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot create a conversation with yourself"
            });
        }

        // Check for block relationship
        const isBlocked = await Block.findOne({
            $or: [
                { blocker: req.user._id, blocked: recipient._id },
                { blocker: recipient._id, blocked: req.user._id }
            ]
        });

        if (isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Unable to start conversation with this user"
            });
        }

        // Check recipient's message privacy settings
        const recipientProfile = await Profile.findOne({ userId: recipient._id });
        if (recipientProfile?.messagePrivacy === "NOBODY") {
            return res.status(403).json({
                success: false,
                message: "This user does not accept direct messages"
            });
        } else if (recipientProfile?.messagePrivacy === "FOLLOWERS_ONLY") {
            const isFollower = await Follow.findOne({
                follower: req.user._id,
                following: recipient._id,
                status: "ACCEPTED"
            });
            if (!isFollower) {
                return res.status(403).json({
                    success: false,
                    message: "This user only accepts direct messages from their followers"
                });
            }
        }

        let conversation = await Conversation.findOne({
            participants: {
                $all: [req.user._id, recipient._id],
                $size: 2
            }
        })
            .populate("participants", "username")
            .populate({
                path: "lastMessage",
                populate: { path: "sender", select: "username" }
            });

        let isNew = false;
        if (!conversation) {
            conversation = new Conversation({
                participants: [req.user._id, recipient._id],
                lastMessageAt: new Date()
            });
            await conversation.save();

            conversation = await Conversation.findById(conversation._id)
                .populate("participants", "username");
            isNew = true;
        }

        const [enriched] = await enrichConversationParticipants([conversation]);

        const unreadCount = isNew
            ? 0
            : await Message.countDocuments({
                  conversation: conversation._id,
                  sender: { $ne: req.user._id },
                  read: false,
                  isDeleted: false
              });

        return res.status(isNew ? 201 : 200).json({
            success: true,
            isNew,
            conversation: {
                ...enriched,
                unreadCount
            }
        });
    } catch (error) {
        console.error("Get or create conversation error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error creating or retrieving conversation"
        });
    }
};

// =====================================================
// GET CONVERSATION MESSAGES (PAGINATED)
// =====================================================
const getConversationMessages = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID format"
            });
        }

        const conversation = await Conversation.findById(id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        const isParticipant = conversation.participants.some((p) =>
            p.equals(req.user._id)
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this conversation"
            });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
        const skip = (page - 1) * limit;

        const total = await Message.countDocuments({ conversation: id });

        const messages = await Message.find({ conversation: id })
            .populate("sender", "username")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Pre-fetch sender profiles for badges & avatar hydration
        const senderIds = messages.map((m) => m.sender?._id).filter(Boolean);
        const profiles = await Profile.find({ userId: { $in: senderIds } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const enrichedMessages = messages.map((m) => {
            const mObj = m.toObject();
            if (mObj.sender) {
                const prof = profileMap.get(mObj.sender._id.toString());
                mObj.sender = {
                    ...mObj.sender,
                    displayName: prof?.displayName || mObj.sender.username,
                    avatar: prof?.avatar || "",
                    isPro: prof?.isPro || false,
                    avatarDecoration: prof?.avatarDecoration || ""
                };
            }
            return mObj;
        });

        const chronologicalMessages = enrichedMessages.reverse();

        return res.status(200).json({
            success: true,
            count: chronologicalMessages.length,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            messages: chronologicalMessages
        });
    } catch (error) {
        console.error("Get conversation messages error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving messages"
        });
    }
};

// =====================================================
// SEND MESSAGE (REST FALLBACK)
// =====================================================
const sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, messageType = "TEXT", mediaUrl, mediaMeta } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID format"
            });
        }

        const trimmedContent = content ? content.trim() : "";

        if (messageType === "TEXT" && !trimmedContent) {
            return res.status(400).json({
                success: false,
                message: "Message content cannot be empty for text messages"
            });
        }

        if (messageType === "IMAGE" && !mediaUrl) {
            return res.status(400).json({
                success: false,
                message: "Media URL is required for image messages"
            });
        }

        if (trimmedContent.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Message exceeds maximum length of 2000 characters"
            });
        }

        const conversation = await Conversation.findById(id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        const isParticipant = conversation.participants.some((p) =>
            p.equals(req.user._id)
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to send messages in this conversation"
            });
        }

        // Check if other participant is blocked
        const otherParticipantIds = conversation.participants.filter(
            (p) => !p.equals(req.user._id)
        );
        const hasBlock = await Block.findOne({
            $or: [
                { blocker: req.user._id, blocked: { $in: otherParticipantIds } },
                { blocker: { $in: otherParticipantIds }, blocked: req.user._id }
            ]
        });

        if (hasBlock) {
            return res.status(403).json({
                success: false,
                message: "Unable to send message. This user is blocked."
            });
        }

        const message = new Message({
            conversation: conversation._id,
            sender: req.user._id,
            messageType: messageType || "TEXT",
            content: trimmedContent,
            mediaUrl: mediaUrl || "",
            mediaMeta: mediaMeta || {},
            read: false
        });
        await message.save();

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        const populatedMessage = await Message.findById(message._id).populate(
            "sender",
            "username"
        );

        const prof = await Profile.findOne({ userId: req.user._id });
        const enrichedMessage = {
            ...populatedMessage.toObject(),
            sender: {
                ...populatedMessage.sender.toObject(),
                displayName: prof?.displayName || populatedMessage.sender.username,
                avatar: prof?.avatar || "",
                isPro: prof?.isPro || false,
                avatarDecoration: prof?.avatarDecoration || ""
            }
        };

        return res.status(201).json({
            success: true,
            message: enrichedMessage
        });
    } catch (error) {
        console.error("Send message error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error sending message"
        });
    }
};

// =====================================================
// DELETE MESSAGE (OWN MESSAGE ONLY)
// =====================================================
const deleteMessage = async (req, res) => {
    try {
        const { id, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format"
            });
        }

        const message = await Message.findOne({
            _id: messageId,
            conversation: id
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        if (!message.sender.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own messages"
            });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        return res.status(200).json({
            success: true,
            message: "Message deleted successfully",
            messageId
        });
    } catch (error) {
        console.error("Delete message error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error deleting message"
        });
    }
};

// =====================================================
// GET GLOBAL UNREAD MESSAGES COUNT
// =====================================================
const getUnreadMessagesCount = async (req, res) => {
    try {
        const userConversations = await Conversation.find({
            participants: req.user._id
        }).select("_id");

        const conversationIds = userConversations.map((c) => c._id);

        const count = await Message.countDocuments({
            conversation: { $in: conversationIds },
            sender: { $ne: req.user._id },
            read: false,
            isDeleted: false
        });

        return res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        console.error("Get unread messages count error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error calculating unread messages count"
        });
    }
};

module.exports = {
    getUserConversations,
    getOrCreateConversation,
    getConversationMessages,
    sendMessage,
    deleteMessage,
    getUnreadMessagesCount
};
