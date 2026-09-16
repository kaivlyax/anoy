const mongoose = require("mongoose");
const Community = require("../models/Community");
const CommunityMessage = require("../models/CommunityMessage");
const Profile = require("../models/Profile");

/**
 * Check if a user is an authorized member/mod/owner of a community
 */
const isAuthorizedCommunityMember = (community, userId) => {
    if (!community || !userId) return false;
    const uId = userId.toString();

    const isOwner = community.owner?.toString() === uId;
    const isMod = community.moderators?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));
    const isMember = community.members?.some((m) => (m._id ? m._id.toString() === uId : m.toString() === uId));

    if (!community.isPrivate) {
        return true; // Public communities can be viewed, but posting might require membership
    }

    return isOwner || isMod || isMember;
};

/**
 * GET /api/v1/communities/:id/messages
 * Retrieve paginated message history for a community channel
 */
const getCommunityMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = (req.query.channel || "general").toLowerCase().trim();

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid community ID format"
            });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        if (community.isPrivate && !isAuthorizedCommunityMember(community, req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You must be a member of this private community to view chat messages."
            });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await CommunityMessage.countDocuments({
            community: id,
            channel,
            isDeleted: false
        });

        const messages = await CommunityMessage.find({
            community: id,
            channel,
            isDeleted: false
        })
            .populate("sender", "username")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Pre-fetch sender profiles for avatars & badges
        const senderIds = messages.map((m) => m.sender?._id).filter(Boolean);
        const profiles = await Profile.find({ userId: { $in: senderIds } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const ownerIdStr = community.owner?.toString();
        const modIdStrs = new Set(
            community.moderators?.map((m) => (m._id ? m._id.toString() : m.toString()))
        );

        const enrichedMessages = messages.map((m) => {
            const mObj = m.toObject();
            if (mObj.sender) {
                const sIdStr = mObj.sender._id.toString();
                const prof = profileMap.get(sIdStr);

                let communityRole = "MEMBER";
                if (sIdStr === ownerIdStr) communityRole = "OWNER";
                else if (modIdStrs.has(sIdStr)) communityRole = "MODERATOR";

                mObj.sender = {
                    ...mObj.sender,
                    displayName: prof?.displayName || mObj.sender.username,
                    avatar: prof?.avatar || "",
                    isPro: prof?.isPro || false,
                    avatarDecoration: prof?.avatarDecoration || "",
                    communityRole
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
        console.error("Get community messages error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving community messages"
        });
    }
};

/**
 * POST /api/v1/communities/:id/messages
 * Send a message to a community channel
 */
const sendCommunityMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            channel = "general",
            content,
            messageType = "TEXT",
            mediaUrl,
            mediaMeta
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid community ID format"
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

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        if (community.isPrivate && !isAuthorizedCommunityMember(community, req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You must join this community to send messages."
            });
        }

        const message = new CommunityMessage({
            community: community._id,
            channel: channel.toLowerCase().trim(),
            sender: req.user._id,
            messageType: messageType || "TEXT",
            content: trimmedContent,
            mediaUrl: mediaUrl || "",
            mediaMeta: mediaMeta || {}
        });
        await message.save();

        const populatedMessage = await CommunityMessage.findById(message._id).populate(
            "sender",
            "username"
        );

        const prof = await Profile.findOne({ userId: req.user._id });
        const ownerIdStr = community.owner?.toString();
        const modIdStrs = new Set(
            community.moderators?.map((m) => (m._id ? m._id.toString() : m.toString()))
        );

        const sIdStr = req.user._id.toString();
        let communityRole = "MEMBER";
        if (sIdStr === ownerIdStr) communityRole = "OWNER";
        else if (modIdStrs.has(sIdStr)) communityRole = "MODERATOR";

        const enrichedMessage = {
            ...populatedMessage.toObject(),
            sender: {
                ...populatedMessage.sender.toObject(),
                displayName: prof?.displayName || populatedMessage.sender.username,
                avatar: prof?.avatar || "",
                isPro: prof?.isPro || false,
                avatarDecoration: prof?.avatarDecoration || "",
                communityRole
            }
        };

        return res.status(201).json({
            success: true,
            message: enrichedMessage
        });
    } catch (error) {
        console.error("Send community message error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error sending community message"
        });
    }
};

/**
 * DELETE /api/v1/communities/:id/messages/:messageId
 * Delete a message (author, community owner, or community moderator)
 */
const deleteCommunityMessage = async (req, res) => {
    try {
        const { id, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format"
            });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        const message = await CommunityMessage.findOne({
            _id: messageId,
            community: id
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        const userIdStr = req.user._id.toString();
        const isAuthor = message.sender.toString() === userIdStr;
        const isOwner = community.owner?.toString() === userIdStr;
        const isMod = community.moderators?.some(
            (m) => (m._id ? m._id.toString() : m.toString()) === userIdStr
        );

        if (!isAuthor && !isOwner && !isMod) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to delete this message"
            });
        }

        message.isDeleted = true;
        message.deletedBy = req.user._id;
        message.deletedAt = new Date();
        await message.save();

        return res.status(200).json({
            success: true,
            message: "Message deleted successfully",
            messageId
        });
    } catch (error) {
        console.error("Delete community message error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error deleting community message"
        });
    }
};

module.exports = {
    getCommunityMessages,
    sendCommunityMessage,
    deleteCommunityMessage
};
