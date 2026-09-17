const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Block = require("../models/Block");
const Follow = require("../models/Follow");
const Post = require("../models/Post");

/**
 * GET /api/v1/settings
 * Fetch comprehensive user settings, account status, and preferences.
 */
const getSettings = async (req, res) => {
    try {
        const identity = await Identity.findById(req.user._id).select(
            "email username loginProvider emailVerified status createdAt"
        );

        if (!identity) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let profile = await Profile.findOne({ userId: req.user._id });
        if (!profile) {
            profile = await Profile.create({
                userId: req.user._id,
                username: req.user.username,
                displayName: req.user.username
            });
        }

        return res.status(200).json({
            success: true,
            settings: {
                account: {
                    id: identity._id,
                    email: identity.email,
                    username: identity.username,
                    loginProvider: identity.loginProvider,
                    emailVerified: identity.emailVerified,
                    status: identity.status,
                    createdAt: identity.createdAt
                },
                profile: {
                    displayName: profile.displayName,
                    bio: profile.bio,
                    avatar: profile.avatar,
                    coverImage: profile.coverImage,
                    isPro: profile.isPro,
                    proPlan: profile.proPlan,
                    proExpiresAt: profile.proExpiresAt
                },
                privacy: {
                    privacy: profile.privacy || "PUBLIC",
                    messagePrivacy: profile.messagePrivacy || "EVERYONE"
                },
                notifications: profile.notificationPreferences || {
                    likes: true,
                    comments: true,
                    follows: true,
                    messages: true,
                    communities: true
                }
            }
        });
    } catch (error) {
        console.error("getSettings error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load settings"
        });
    }
};

/**
 * POST /api/v1/settings/change-password
 * Change password and invalidate other sessions by bumping tokenVersion.
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters"
            });
        }

        const user = await Identity.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = newHash;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Sign new token for current device
        const newToken = jwt.sign(
            {
                userId: user._id.toString(),
                username: user.username,
                tokenVersion: user.tokenVersion
            },
            process.env.JWT_SECRET || "anoy_jwt_secret_key_default_32_chars",
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
            token: newToken
        });
    } catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to change password"
        });
    }
};

/**
 * PUT /api/v1/settings/privacy
 * Update account privacy (PUBLIC/PRIVATE) and direct messaging rules.
 */
const updatePrivacy = async (req, res) => {
    try {
        const { privacy, messagePrivacy } = req.body;

        const updateData = {};
        if (privacy && ["PUBLIC", "PRIVATE"].includes(privacy)) {
            updateData.privacy = privacy;
        }
        if (messagePrivacy && ["EVERYONE", "FOLLOWERS_ONLY", "NOBODY"].includes(messagePrivacy)) {
            updateData.messagePrivacy = messagePrivacy;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid privacy settings provided"
            });
        }

        const profile = await Profile.findOneAndUpdate(
            { userId: req.user._id },
            { $set: updateData },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Privacy settings updated successfully",
            privacy: {
                privacy: profile.privacy,
                messagePrivacy: profile.messagePrivacy
            }
        });
    } catch (error) {
        console.error("updatePrivacy error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update privacy settings"
        });
    }
};

/**
 * PUT /api/v1/settings/notifications
 * Update notification preferences for likes, comments, follows, messages, communities.
 */
const updateNotifications = async (req, res) => {
    try {
        const { likes, comments, follows, messages, communities } = req.body;

        const updateFields = {};
        if (typeof likes === "boolean") updateFields["notificationPreferences.likes"] = likes;
        if (typeof comments === "boolean") updateFields["notificationPreferences.comments"] = comments;
        if (typeof follows === "boolean") updateFields["notificationPreferences.follows"] = follows;
        if (typeof messages === "boolean") updateFields["notificationPreferences.messages"] = messages;
        if (typeof communities === "boolean") updateFields["notificationPreferences.communities"] = communities;

        const profile = await Profile.findOneAndUpdate(
            { userId: req.user._id },
            { $set: updateFields },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Notification preferences updated successfully",
            notifications: profile.notificationPreferences
        });
    } catch (error) {
        console.error("updateNotifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update notification preferences"
        });
    }
};

/**
 * GET /api/v1/settings/blocked
 * Get list of all users blocked by the current user.
 */
const getBlockedUsers = async (req, res) => {
    try {
        const blocks = await Block.find({ blocker: req.user._id }).populate("blocked", "username email");

        const blockedUserIds = blocks
            .map((b) => b.blocked?._id)
            .filter(Boolean);

        const profiles = await Profile.find({ userId: { $in: blockedUserIds } }).select(
            "userId username displayName avatar bio isPro avatarDecoration"
        );

        const profileMap = new Map();
        profiles.forEach((p) => {
            profileMap.set(p.userId.toString(), p);
        });

        const blockedList = blocks.map((b) => {
            const blockedUser = b.blocked;
            const prof = blockedUser ? profileMap.get(blockedUser._id.toString()) : null;
            return {
                blockId: b._id,
                userId: blockedUser?._id,
                username: blockedUser?.username || prof?.username || "unknown",
                displayName: prof?.displayName || blockedUser?.username || "User",
                avatar: prof?.avatar || "",
                bio: prof?.bio || "",
                isPro: prof?.isPro || false,
                avatarDecoration: prof?.avatarDecoration || "",
                blockedAt: b.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            blockedUsers: blockedList
        });
    } catch (error) {
        console.error("getBlockedUsers error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load blocked users"
        });
    }
};

/**
 * POST /api/v1/settings/block/:username
 * Block a user and sever follow connections in both directions.
 */
const blockUser = async (req, res) => {
    try {
        const targetUsername = (req.params.username || req.body.username || "").toLowerCase().trim();

        if (!targetUsername) {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        if (targetUsername === req.user.username.toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself"
            });
        }

        const targetUser = await Identity.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Create or ensure block record
        await Block.findOneAndUpdate(
            { blocker: req.user._id, blocked: targetUser._id },
            { blocker: req.user._id, blocked: targetUser._id },
            { upsert: true, new: true }
        );

        // Remove follow relationships in both directions
        await Follow.deleteMany({
            $or: [
                { follower: req.user._id, following: targetUser._id },
                { follower: targetUser._id, following: req.user._id }
            ]
        });

        return res.status(200).json({
            success: true,
            message: `User @${targetUsername} has been blocked.`
        });
    } catch (error) {
        console.error("blockUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to block user"
        });
    }
};

/**
 * POST /api/v1/settings/unblock/:username
 * Unblock a previously blocked user.
 */
const unblockUser = async (req, res) => {
    try {
        const targetUsername = (req.params.username || req.body.username || "").toLowerCase().trim();

        if (!targetUsername) {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        const targetUser = await Identity.findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        await Block.findOneAndDelete({
            blocker: req.user._id,
            blocked: targetUser._id
        });

        return res.status(200).json({
            success: true,
            message: `User @${targetUsername} has been unblocked.`
        });
    } catch (error) {
        console.error("unblockUser error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to unblock user"
        });
    }
};

/**
 * POST /api/v1/settings/logout-all
 * Invalidate all sessions across all devices by incrementing tokenVersion.
 */
const logoutAllDevices = async (req, res) => {
    try {
        const user = await Identity.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Logged out from all devices successfully."
        });
    } catch (error) {
        console.error("logoutAllDevices error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to logout from all devices"
        });
    }
};

/**
 * POST /api/v1/settings/delete-account
 * Delete user account with password verification and "DELETE" confirmation text.
 */
const deleteAccount = async (req, res) => {
    try {
        const { password, confirmationText } = req.body;

        if (confirmationText !== "DELETE") {
            return res.status(400).json({
                success: false,
                message: 'Please type "DELETE" exactly to confirm account deletion.'
            });
        }

        const user = await Identity.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check password if user has passwordHash
        if (user.passwordHash) {
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: "Password is required to confirm account deletion."
                });
            }
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Incorrect password. Account was not deleted."
                });
            }
        }

        // Mark account DELETED and bump token version
        user.status = "DELETED";
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Soft-delete user posts
        await Post.updateMany({ author: user._id }, { isDeleted: true });

        // Clean up follow relationships
        await Follow.deleteMany({
            $or: [{ follower: user._id }, { following: user._id }]
        });

        // Clean up blocks
        await Block.deleteMany({
            $or: [{ blocker: user._id }, { blocked: user._id }]
        });

        return res.status(200).json({
            success: true,
            message: "Your account has been deleted. We are sorry to see you go."
        });
    } catch (error) {
        console.error("deleteAccount error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete account"
        });
    }
};

module.exports = {
    getSettings,
    changePassword,
    updatePrivacy,
    updateNotifications,
    getBlockedUsers,
    blockUser,
    unblockUser,
    logoutAllDevices,
    deleteAccount
};
