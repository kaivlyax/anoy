const mongoose = require("mongoose");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const AdminAuditLog = require("../models/AdminAuditLog");
const Post = require("../models/Post");
const { isUserRestricted } = require("../middleware/restrictionMiddleware");

/**
 * GET /api/v1/admin/users
 * Search and list platform users with status, role, and profile details.
 */
const listUsers = async (req, res) => {
    try {
        const { q, role, status, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const skip = (pageNum - 1) * limitNum;

        const filter = {};

        if (role) {
            filter.role = role.toUpperCase();
        }

        if (status) {
            const statusUpper = status.toUpperCase();
            if (statusUpper === "RESTRICTED") {
                filter["restriction.isRestricted"] = true;
                filter.$and = [
                    {
                        $or: [
                            { "restriction.expiresAt": null },
                            { "restriction.expiresAt": { $gt: new Date() } }
                        ]
                    }
                ];
            } else {
                filter.status = statusUpper;
            }
        }

        if (q && q.trim()) {
            const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter.$or = [{ username: regex }, { email: regex }];
        }

        const total = await Identity.countDocuments(filter);
        const identities = await Identity.find(filter)
            .select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP")
            .populate("bannedBy", "username email")
            .populate("restriction.restrictedBy", "username email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const userIds = identities.map((u) => u._id);
        const profiles = await Profile.find({ userId: { $in: userIds } })
            .select("userId displayName avatar bio isPro privacy");

        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const enrichedUsers = identities.map((ident) => {
            const prof = profileMap.get(ident._id.toString());
            const restrictionStatus = isUserRestricted(ident);
            return {
                _id: ident._id,
                username: ident.username,
                email: ident.email,
                role: ident.role || "USER",
                status: ident.status,
                emailVerified: ident.emailVerified,
                banReason: ident.banReason || null,
                bannedAt: ident.bannedAt || null,
                bannedBy: ident.bannedBy || null,
                restriction: restrictionStatus,
                lastLogin: ident.lastLogin || null,
                createdAt: ident.createdAt,
                profile: prof
                    ? {
                          displayName: prof.displayName || ident.username,
                          avatar: prof.avatar || "",
                          bio: prof.bio || "",
                          isPro: prof.isPro || false,
                          privacy: prof.privacy || "PUBLIC"
                      }
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            users: enrichedUsers
        });
    } catch (error) {
        console.error("admin listUsers error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error listing users"
        });
    }
};

/**
 * GET /api/v1/admin/users/:id
 * Retrieve comprehensive details and statistics for a specific user.
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        const user = await Identity.findById(id)
            .select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP")
            .populate("bannedBy", "username email")
            .populate("restriction.restrictedBy", "username email");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const profile = await Profile.findOne({ userId: user._id });
        const postCount = await Post.countDocuments({ author: user._id });

        return res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role || "USER",
                status: user.status,
                emailVerified: user.emailVerified,
                banReason: user.banReason || null,
                bannedAt: user.bannedAt || null,
                bannedBy: user.bannedBy || null,
                restriction: isUserRestricted(user),
                lastLogin: user.lastLogin || null,
                createdAt: user.createdAt,
                postCount,
                profile: profile
                    ? {
                          displayName: profile.displayName || user.username,
                          avatar: profile.avatar || "",
                          bio: profile.bio || "",
                          isPro: profile.isPro || false,
                          privacy: profile.privacy || "PUBLIC"
                      }
                    : null
            }
        });
    } catch (error) {
        console.error("admin getUserById error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving user details"
        });
    }
};

/**
 * POST /api/v1/admin/users/:id/ban
 * Globally ban a user, immediately invalidate their sessions/tokens, and record an audit log.
 */
const banUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        const targetUser = await Identity.findById(id);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (targetUser._id.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot ban your own administrator account"
            });
        }

        if (targetUser.role === "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Cannot ban another platform administrator"
            });
        }

        if (targetUser.status === "BANNED") {
            return res.status(400).json({
                success: false,
                message: "User is already banned"
            });
        }

        const banReasonStr = (reason && reason.trim()) ? reason.trim() : "Banned by administrator";

        // Atomically set status to BANNED and bump tokenVersion to invalidate existing JWTs
        const updatedUser = await Identity.findByIdAndUpdate(
            targetUser._id,
            {
                $set: {
                    status: "BANNED",
                    banReason: banReasonStr,
                    bannedAt: new Date(),
                    bannedBy: req.user._id
                },
                $inc: {
                    tokenVersion: 1
                }
            },
            { returnDocument: "after" }
        ).select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP");

        // Record immutable audit log
        await AdminAuditLog.create({
            admin: req.user._id,
            action: "USER_BAN",
            targetUser: targetUser._id,
            reason: banReasonStr,
            metadata: {
                previousStatus: targetUser.status,
                role: targetUser.role
            },
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || ""
        });

        return res.status(200).json({
            success: true,
            message: `User @${targetUser.username} has been banned successfully`,
            user: updatedUser
        });
    } catch (error) {
        console.error("admin banUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error banning user"
        });
    }
};

/**
 * POST /api/v1/admin/users/:id/unban
 * Unban a user, restoring ACTIVE status and recording an audit log.
 */
const unbanUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        const targetUser = await Identity.findById(id);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (targetUser.status !== "BANNED") {
            return res.status(400).json({
                success: false,
                message: "User is not currently banned"
            });
        }

        const unbanReasonStr = (reason && reason.trim()) ? reason.trim() : "Unbanned by administrator";

        const updatedUser = await Identity.findByIdAndUpdate(
            targetUser._id,
            {
                $set: {
                    status: "ACTIVE",
                    banReason: null,
                    bannedAt: null,
                    bannedBy: null
                }
            },
            { returnDocument: "after" }
        ).select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP");

        // Record immutable audit log
        await AdminAuditLog.create({
            admin: req.user._id,
            action: "USER_UNBAN",
            targetUser: targetUser._id,
            reason: unbanReasonStr,
            metadata: {
                previousBanReason: targetUser.banReason
            },
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || ""
        });

        return res.status(200).json({
            success: true,
            message: `User @${targetUser.username} has been unbanned successfully`,
            user: updatedUser
        });
    } catch (error) {
        console.error("admin unbanUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error unbanning user"
        });
    }
};

/**
 * GET or POST /api/v1/admin/conversations/:id/messages
 * Target-specific private message review.
 * Strictly requires a mandatory non-empty reason and records an immutable audit log.
 */
const reviewPrivateMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = req.query.reason || req.body?.reason;

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: "A mandatory, non-empty reason is required to review private messages"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID format"
            });
        }

        const conversation = await Conversation.findById(id)
            .populate("participants", "username email role status");

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found"
            });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const skip = (page - 1) * limit;

        const total = await Message.countDocuments({ conversation: id });
        const messages = await Message.find({ conversation: id })
            .populate("sender", "username email")
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit);

        const participantUserIds = conversation.participants.map((p) => p._id);

        // Record immutable audit log
        await AdminAuditLog.create({
            admin: req.user._id,
            action: "PRIVATE_MESSAGE_REVIEW",
            targetConversation: conversation._id,
            targetUsers: participantUserIds,
            reason: reason.trim(),
            metadata: {
                participantUsernames: conversation.participants.map((p) => p.username),
                messagesReviewedCount: messages.length,
                totalConversationMessages: total
            },
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || ""
        });

        return res.status(200).json({
            success: true,
            conversation: {
                _id: conversation._id,
                participants: conversation.participants,
                lastMessageAt: conversation.lastMessageAt
            },
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            messages
        });
    } catch (error) {
        console.error("admin reviewPrivateMessages error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error reviewing private messages"
        });
    }
};

/**
 * GET /api/v1/admin/audit-logs
 * View paginated immutable platform administrative audit logs.
 */
const getAuditLogs = async (req, res) => {
    try {
        const { action, adminId, targetUserId, page = 1, limit = 30 } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
        const skip = (pageNum - 1) * limitNum;

        const filter = {};

        if (action) {
            filter.action = action.toUpperCase();
        }

        if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
            filter.admin = adminId;
        }

        if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
            filter.targetUser = targetUserId;
        }

        const total = await AdminAuditLog.countDocuments(filter);
        const logs = await AdminAuditLog.find(filter)
            .populate("admin", "username email role")
            .populate("targetUser", "username email role status")
            .populate("targetUsers", "username email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            logs
        });
    } catch (error) {
        console.error("admin getAuditLogs error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving audit logs"
        });
    }
};

/**
 * GET /api/v1/admin/users/:id/conversations
 * Admin-only conversation lookup for a specific user.
 * Returns conversations involving this user with participant details and last message metadata.
 */
const getUserConversations = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        const targetUser = await Identity.findById(id).select("username email role status");
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const conversations = await Conversation.find({
            participants: targetUser._id
        })
            .populate("participants", "username email role status")
            .populate({
                path: "lastMessage",
                select: "content sender createdAt type mediaUrl"
            })
            .sort({ lastMessageAt: -1 });

        // Collect all participant IDs to enrich with Profile info
        const userIds = new Set();
        conversations.forEach((conv) => {
            conv.participants?.forEach((p) => {
                if (p && p._id) {
                    userIds.add(p._id.toString());
                }
            });
        });

        const profiles = await Profile.find({
            userId: { $in: Array.from(userIds) }
        }).select("userId displayName avatar isPro privacy");

        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const enrichedConversations = conversations.map((conv) => {
            const convObj = conv.toObject();
            convObj.participants = convObj.participants.map((p) => {
                const prof = profileMap.get(p._id.toString());
                return {
                    _id: p._id,
                    username: p.username,
                    email: p.email,
                    role: p.role || "USER",
                    status: p.status,
                    displayName: prof?.displayName || p.username,
                    avatar: prof?.avatar || "",
                    isPro: prof?.isPro || false,
                    privacy: prof?.privacy || "PUBLIC"
                };
            });
            return convObj;
        });

        return res.status(200).json({
            success: true,
            user: {
                _id: targetUser._id,
                username: targetUser.username,
                email: targetUser.email
            },
            total: enrichedConversations.length,
            conversations: enrichedConversations
        });
    } catch (error) {
        console.error("admin getUserConversations error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving user conversations"
        });
    }
};

/**
 * POST /api/v1/admin/users/:id/restrict
 * Apply temporary or permanent interaction restriction to a user account.
 */
const restrictUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, duration, expiresAt } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: "A mandatory reason is required to restrict a user"
            });
        }

        const targetUser = await Identity.findById(id);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (targetUser._id.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot restrict your own administrator account"
            });
        }

        if (targetUser.role === "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Cannot restrict another platform administrator"
            });
        }

        if (targetUser.status === "BANNED") {
            return res.status(400).json({
                success: false,
                message: "Cannot restrict an account that is already globally banned"
            });
        }

        let calculatedExpiresAt = null;
        if (expiresAt) {
            const expDate = new Date(expiresAt);
            if (!isNaN(expDate.getTime()) && expDate > new Date()) {
                calculatedExpiresAt = expDate;
            }
        } else if (duration) {
            const d = duration.toLowerCase();
            const now = Date.now();
            if (d === "1h") calculatedExpiresAt = new Date(now + 60 * 60 * 1000);
            else if (d === "24h" || d === "1d") calculatedExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
            else if (d === "3d") calculatedExpiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000);
            else if (d === "7d" || d === "1w") calculatedExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
            else if (d === "30d" || d === "1m") calculatedExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
            else if (d === "permanent") calculatedExpiresAt = null;
        }

        const restrictionData = {
            isRestricted: true,
            reason: reason.trim(),
            restrictedAt: new Date(),
            expiresAt: calculatedExpiresAt,
            restrictedBy: req.user._id
        };

        const updatedUser = await Identity.findByIdAndUpdate(
            targetUser._id,
            {
                $set: {
                    restriction: restrictionData
                }
            },
            { returnDocument: "after" }
        ).select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP")
        .populate("bannedBy", "username email")
        .populate("restriction.restrictedBy", "username email");

        // Record immutable audit log
        await AdminAuditLog.create({
            admin: req.user._id,
            action: "USER_RESTRICT",
            targetUser: targetUser._id,
            reason: reason.trim(),
            metadata: {
                duration: duration || "custom",
                expiresAt: calculatedExpiresAt,
                isPermanent: !calculatedExpiresAt
            },
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || ""
        });

        return res.status(200).json({
            success: true,
            message: `User @${targetUser.username} has been restricted successfully`,
            user: {
                ...updatedUser.toObject(),
                restriction: isUserRestricted(updatedUser)
            }
        });
    } catch (error) {
        console.error("admin restrictUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error restricting user"
        });
    }
};

/**
 * POST /api/v1/admin/users/:id/unrestrict
 * Remove interaction restriction from a user account.
 */
const unrestrictUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        const targetUser = await Identity.findById(id);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const unrestrictReasonStr = (reason && reason.trim()) ? reason.trim() : "Restriction removed by administrator";

        const updatedUser = await Identity.findByIdAndUpdate(
            targetUser._id,
            {
                $set: {
                    restriction: {
                        isRestricted: false,
                        reason: null,
                        restrictedAt: null,
                        expiresAt: null,
                        restrictedBy: null
                    }
                }
            },
            { returnDocument: "after" }
        ).select("-passwordHash -verificationOTP -verificationOTPHash -passwordResetOTP")
        .populate("bannedBy", "username email");

        // Record immutable audit log
        await AdminAuditLog.create({
            admin: req.user._id,
            action: "USER_UNRESTRICT",
            targetUser: targetUser._id,
            reason: unrestrictReasonStr,
            metadata: {
                previousRestriction: targetUser.restriction
            },
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || ""
        });

        return res.status(200).json({
            success: true,
            message: `Restriction for @${targetUser.username} has been lifted`,
            user: {
                ...updatedUser.toObject(),
                restriction: isUserRestricted(updatedUser)
            }
        });
    } catch (error) {
        console.error("admin unrestrictUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error unrestricting user"
        });
    }
};

module.exports = {
    listUsers,
    getUserById,
    getUserConversations,
    banUser,
    unbanUser,
    restrictUser,
    unrestrictUser,
    reviewPrivateMessages,
    getAuditLogs
};
