const Community = require("../models/Community");
const CommunityBoost = require("../models/CommunityBoost");
const ModerationLog = require("../models/ModerationLog");
const CommunityReport = require("../models/CommunityReport");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const { findItemById } = require("../config/storeCatalog");

/**
 * Helper to determine user's role in a community.
 */
const getUserRole = (community, userId) => {
    if (!userId) return "NONE";
    const uIdStr = userId.toString();
    if (community.owner && community.owner._id ? community.owner._id.toString() === uIdStr : community.owner.toString() === uIdStr) {
        return "OWNER";
    }
    if (community.moderators && community.moderators.some((m) => (m._id ? m._id.toString() === uIdStr : m.toString() === uIdStr))) {
        return "MODERATOR";
    }
    if (community.members && community.members.some((m) => (m._id ? m._id.toString() === uIdStr : m.toString() === uIdStr))) {
        return "MEMBER";
    }
    return "NONE";
};

/**
 * List all communities with search, filtering, and boost ranking.
 */
const getCommunities = async (req, res) => {
    try {
        const { q, boosted } = req.query;
        const filter = {};

        if (q) {
            filter.$or = [
                { name: { $regex: q.trim(), $options: "i" } },
                { slug: { $regex: q.trim(), $options: "i" } },
                { description: { $regex: q.trim(), $options: "i" } }
            ];
        }

        if (boosted === "true") {
            filter.isBoosted = true;
        }

        const communities = await Community.find(filter)
            .sort({ isBoosted: -1, boostLevel: -1, boostCount: -1, createdAt: -1 })
            .limit(50);

        const currentUserId = req.user?._id;

        const results = communities.map((comm) => ({
            _id: comm._id,
            name: comm.name,
            slug: comm.slug,
            description: comm.description,
            avatar: comm.avatar,
            coverImage: comm.coverImage,
            isPrivate: comm.isPrivate,
            memberCount: comm.members?.length || 0,
            boostCount: comm.boostCount || 0,
            boostLevel: comm.boostLevel || 0,
            isBoosted: Boolean(comm.isBoosted),
            activeDecorations: comm.activeDecorations,
            userRole: getUserRole(comm, currentUserId),
            createdAt: comm.createdAt
        }));

        return res.status(200).json({ success: true, communities: results });
    } catch (error) {
        console.error("getCommunities error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get single community by slug or id with full enriched details.
 */
const getCommunity = async (req, res) => {
    try {
        const { slugOrId } = req.params;
        let community;

        if (slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
            community = await Community.findById(slugOrId);
        }
        if (!community) {
            community = await Community.findOne({ slug: slugOrId.toLowerCase().trim() });
        }

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        // Fetch owner and moderator profile details
        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = new Set(deletedUsers.map((u) => u._id.toString()));

        const ownerIdentity = await Identity.findById(community.owner);
        const isOwnerDeleted = !ownerIdentity || ownerIdentity.status === "DELETED";
        const ownerProfile = isOwnerDeleted ? null : await Profile.findOne({ userId: community.owner });

        const validModeratorIds = (community.moderators || []).filter((m) => !deletedUserIds.has(m.toString()));
        const validMemberIds = (community.members || []).filter((m) => !deletedUserIds.has(m.toString()));

        const modProfiles = await Profile.find({ userId: { $in: validModeratorIds } });
        const memberProfiles = await Profile.find({ userId: { $in: validMemberIds } }).limit(20);

        const currentUserId = req.user?._id;

        return res.status(200).json({
            success: true,
            community: {
                _id: community._id,
                name: community.name,
                slug: community.slug,
                description: community.description,
                avatar: community.avatar,
                coverImage: community.coverImage,
                isPrivate: community.isPrivate,
                owner: isOwnerDeleted
                    ? null
                    : {
                          _id: community.owner,
                          username: ownerIdentity.username || ownerProfile?.username || "unknown",
                          displayName: ownerProfile?.displayName || ownerIdentity.username || "Unknown",
                          avatar: ownerProfile?.avatar || "",
                          isPro: ownerProfile?.isPro || false,
                          avatarDecoration: ownerProfile?.avatarDecoration || ""
                      },
                moderators: modProfiles.map((p) => ({
                    _id: p.userId,
                    username: p.username,
                    displayName: p.displayName || p.username,
                    avatar: p.avatar,
                    isPro: p.isPro || false
                })),
                members: memberProfiles.map((p) => ({
                    _id: p.userId,
                    username: p.username,
                    displayName: p.displayName || p.username,
                    avatar: p.avatar,
                    isPro: p.isPro || false
                })),
                memberCount: validMemberIds.length,
                boostCount: community.boostCount || 0,
                boostLevel: community.boostLevel || 0,
                isBoosted: Boolean(community.isBoosted),
                activeDecorations: community.activeDecorations,
                unlockedDecorations: community.unlockedDecorations || [],
                settings: community.settings,
                userRole: getUserRole(community, currentUserId),
                createdAt: community.createdAt
            }
        });
    } catch (error) {
        console.error("getCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Create a new community.
 */
const createCommunity = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, slug, description, avatar, coverImage, isPrivate } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Community name is required" });
        }

        const normalizedSlug = (slug || name)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]/g, "-")
            .replace(/-+/g, "-");

        const existing = await Community.findOne({ slug: normalizedSlug });
        if (existing) {
            return res.status(400).json({ success: false, message: "A community with this handle/slug already exists" });
        }

        const community = await Community.create({
            name: name.trim(),
            slug: normalizedSlug,
            description: description || "",
            avatar: avatar || "",
            coverImage: coverImage || "",
            isPrivate: Boolean(isPrivate),
            owner: userId,
            moderators: [],
            members: [userId],
            boostCount: 0,
            boostLevel: 0,
            isBoosted: false,
            activeDecorations: {
                iconFrame: "",
                bannerTheme: "",
                chatBackground: "",
                theme: "default"
            },
            unlockedDecorations: []
        });

        return res.status(201).json({
            success: true,
            message: "Community created successfully!",
            community
        });
    } catch (error) {
        console.error("createCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Update community settings & metadata (Owner only).
 */
const updateCommunity = async (req, res) => {
    try {
        const community = req.community;
        const { name, description, avatar, coverImage, isPrivate, settings } = req.body;

        if (name !== undefined) community.name = name.trim();
        if (description !== undefined) community.description = description;
        if (avatar !== undefined) community.avatar = avatar;
        if (coverImage !== undefined) community.coverImage = coverImage;
        if (isPrivate !== undefined) community.isPrivate = Boolean(isPrivate);
        if (settings !== undefined) {
            community.settings = {
                ...community.settings,
                ...settings
            };
        }

        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            action: "UPDATE_SETTINGS",
            reason: "Updated community settings/profile",
            metadata: { name, isPrivate, settings }
        }).catch((e) => console.warn("ModerationLog create error:", e));

        return res.status(200).json({
            success: true,
            message: "Community updated successfully",
            community
        });
    } catch (error) {
        console.error("updateCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Join a community.
 */
const joinCommunity = async (req, res) => {
    try {
        const community = req.community;
        const userId = req.user._id;

        const isBanned = community.bannedUsers?.some((b) => (b.user?._id ? b.user._id.equals(userId) : b.user?.equals?.(userId)));
        if (isBanned) {
            return res.status(403).json({
                success: false,
                message: "You have been banned from this community."
            });
        }

        if (!community.members.some((m) => m.equals(userId))) {
            community.members.push(userId);
            await community.save();
        }

        return res.status(200).json({
            success: true,
            message: `Joined ${community.name}!`,
            memberCount: community.members.length,
            userRole: getUserRole(community, userId)
        });
    } catch (error) {
        console.error("joinCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Leave a community.
 */
const leaveCommunity = async (req, res) => {
    try {
        const community = req.community;
        const userId = req.user._id;

        if (community.owner.equals(userId)) {
            return res.status(400).json({
                success: false,
                message: "As the community owner, you cannot leave without transferring ownership."
            });
        }

        community.members = community.members.filter((m) => !m.equals(userId));
        community.moderators = community.moderators.filter((m) => !m.equals(userId));
        await community.save();

        return res.status(200).json({
            success: true,
            message: `Left ${community.name}`,
            memberCount: community.members.length,
            userRole: "NONE"
        });
    } catch (error) {
        console.error("leaveCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Add or Promote Moderator (Owner only).
 */
const addModerator = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId, username } = req.body;

        let targetUser = null;
        if (targetUserId) {
            targetUser = await Identity.findById(targetUserId);
        } else if (username) {
            targetUser = await Identity.findOne({ username: username.toLowerCase().trim() });
        }

        if (!targetUser || targetUser.status === "DELETED") {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }

        // Cannot promote if banned
        const isBanned = community.bannedUsers?.some((b) => (b.user?._id ? b.user._id.equals(targetUser._id) : b.user?.equals?.(targetUser._id)));
        if (isBanned) {
            return res.status(400).json({ success: false, message: "Cannot promote a banned user to moderator" });
        }

        if (!community.members.some((m) => m.equals(targetUser._id))) {
            community.members.push(targetUser._id);
        }

        if (!community.moderators.some((m) => m.equals(targetUser._id))) {
            community.moderators.push(targetUser._id);
        }

        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: targetUser._id,
            action: "PROMOTE_MODERATOR",
            reason: req.body.reason || "Promoted to moderator by community owner",
            metadata: { targetUsername: targetUser.username }
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: `${targetUser.username} is now a moderator of ${community.name}`,
            moderators: community.moderators
        });
    } catch (error) {
        console.error("addModerator error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Remove / Demote Moderator (Owner only).
 */
const removeModerator = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId } = req.params;

        community.moderators = community.moderators.filter((m) => m.toString() !== targetUserId);
        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: targetUserId,
            action: "DEMOTE_MODERATOR",
            reason: req.body?.reason || "Demoted from moderator to member by community owner"
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: "Moderator removed",
            moderators: community.moderators
        });
    } catch (error) {
        console.error("removeModerator error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Remove Member from Community (Owner or Moderator).
 */
const removeMember = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId } = req.params;

        if (community.owner.toString() === targetUserId) {
            return res.status(403).json({ success: false, message: "Cannot remove the community owner" });
        }

        // If requester is a moderator (not owner), they cannot kick other moderators
        if (!community.owner.equals(req.user._id)) {
            const isTargetMod = community.moderators.some((m) => m.toString() === targetUserId);
            if (isTargetMod) {
                return res.status(403).json({ success: false, message: "Moderators cannot remove fellow moderators" });
            }
        }

        community.members = community.members.filter((m) => m.toString() !== targetUserId);
        community.moderators = community.moderators.filter((m) => m.toString() !== targetUserId);
        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: targetUserId,
            action: "REMOVE_MEMBER",
            reason: req.body?.reason || "Removed from community by moderator/owner"
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: "Member removed from community",
            memberCount: community.members.length
        });
    } catch (error) {
        console.error("removeMember error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Ban Member from Community (Owner or Moderator).
 */
const banCommunityMember = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId } = req.params;
        const { reason } = req.body;

        if (community.owner.toString() === targetUserId) {
            return res.status(403).json({ success: false, message: "Cannot ban the community owner" });
        }

        // If requester is moderator (not owner), they cannot ban other moderators
        if (!community.owner.equals(req.user._id)) {
            const isTargetMod = community.moderators.some((m) => m.toString() === targetUserId);
            if (isTargetMod) {
                return res.status(403).json({ success: false, message: "Moderators cannot ban fellow moderators" });
            }
        }

        // Remove from members and moderators
        community.members = community.members.filter((m) => m.toString() !== targetUserId);
        community.moderators = community.moderators.filter((m) => m.toString() !== targetUserId);

        // Add to bannedUsers if not already present
        if (!community.bannedUsers) community.bannedUsers = [];
        const alreadyBanned = community.bannedUsers.some((b) => (b.user?._id ? b.user._id.toString() === targetUserId : b.user?.toString() === targetUserId));

        if (!alreadyBanned) {
            community.bannedUsers.push({
                user: targetUserId,
                bannedBy: req.user._id,
                reason: reason || "Violation of community rules",
                bannedAt: new Date()
            });
        }

        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: targetUserId,
            action: "BAN_MEMBER",
            reason: reason || "Violation of community rules"
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: "User banned from community",
            bannedUsers: community.bannedUsers
        });
    } catch (error) {
        console.error("banCommunityMember error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Unban Member from Community (Owner or Moderator).
 */
const unbanCommunityMember = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId } = req.params;

        community.bannedUsers = (community.bannedUsers || []).filter(
            (b) => (b.user?._id ? b.user._id.toString() !== targetUserId : b.user?.toString() !== targetUserId)
        );

        await community.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: targetUserId,
            action: "UNBAN_MEMBER",
            reason: req.body?.reason || "Unbanned by moderator"
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: "User unbanned from community"
        });
    } catch (error) {
        console.error("unbanCommunityMember error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get Banned Members of a Community (Owner or Moderator).
 */
const getBannedMembers = async (req, res) => {
    try {
        const community = req.community;
        const bannedList = community.bannedUsers || [];

        const userIds = [];
        bannedList.forEach((b) => {
            if (b.user) userIds.push(b.user);
            if (b.bannedBy) userIds.push(b.bannedBy);
        });

        const profiles = await Profile.find({ userId: { $in: userIds } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const results = bannedList.map((b) => {
            const uId = b.user?.toString();
            const byId = b.bannedBy?.toString();
            const uProf = profileMap.get(uId);
            const byProf = profileMap.get(byId);

            return {
                _id: b._id,
                bannedAt: b.bannedAt,
                reason: b.reason,
                user: {
                    _id: uId,
                    username: uProf?.username || "unknown",
                    displayName: uProf?.displayName || uProf?.username || "Unknown",
                    avatar: uProf?.avatar || "",
                    isPro: uProf?.isPro || false
                },
                bannedBy: {
                    _id: byId,
                    username: byProf?.username || "moderator",
                    displayName: byProf?.displayName || byProf?.username || "Moderator"
                }
            };
        });

        return res.status(200).json({
            success: true,
            count: results.length,
            bannedUsers: results
        });
    } catch (error) {
        console.error("getBannedMembers error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get Community Members with search and role filters.
 */
const getCommunityMembers = async (req, res) => {
    try {
        const community = req.community;
        const { q, role, page = 1, limit = 30 } = req.query;

        // Build list of all member IDs
        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = new Set(deletedUsers.map((u) => u._id.toString()));

        const ownerId = community.owner?.toString();
        const modIds = new Set((community.moderators || []).map((m) => m.toString()));
        const memberIds = new Set((community.members || []).map((m) => m.toString()));
        if (ownerId && !deletedUserIds.has(ownerId)) memberIds.add(ownerId);

        const allUserIds = Array.from(memberIds).filter((id) => !deletedUserIds.has(id.toString()));

        const profileFilter = { userId: { $in: allUserIds } };
        if (q && q.trim()) {
            const regex = new RegExp(q.trim(), "i");
            profileFilter.$or = [{ username: regex }, { displayName: regex }];
        }

        const profiles = await Profile.find(profileFilter);

        let mapped = profiles.map((p) => {
            const uId = p.userId.toString();
            let r = "MEMBER";
            if (uId === ownerId) r = "OWNER";
            else if (modIds.has(uId)) r = "MODERATOR";

            return {
                _id: p.userId,
                username: p.username,
                displayName: p.displayName || p.username,
                avatar: p.avatar || "",
                avatarDecoration: p.avatarDecoration || "",
                bio: p.bio || "",
                skills: p.skills || [],
                isPro: p.isPro || false,
                role: r,
                joinedAt: p.createdAt
            };
        });

        const counts = {
            all: profiles.length,
            owners: mapped.filter((m) => m.role === "OWNER").length,
            moderators: mapped.filter((m) => m.role === "MODERATOR").length,
            members: mapped.filter((m) => m.role === "MEMBER").length
        };

        if (role && role !== "ALL") {
            mapped = mapped.filter((m) => m.role === role.toUpperCase());
        }

        // Sort: OWNER first, MODERATOR next, then MEMBER, sorted by name
        const roleOrder = { OWNER: 0, MODERATOR: 1, MEMBER: 2 };
        mapped.sort((a, b) => {
            const orderDiff = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
            if (orderDiff !== 0) return orderDiff;
            return a.displayName.localeCompare(b.displayName);
        });

        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
        const startIndex = (p - 1) * l;
        const paginated = mapped.slice(startIndex, startIndex + l);

        return res.status(200).json({
            success: true,
            total: mapped.length,
            page: p,
            limit: l,
            counts,
            members: paginated
        });
    } catch (error) {
        console.error("getCommunityMembers error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get Moderation Audit Logs (Owner or Moderator).
 */
const getModerationLogs = async (req, res) => {
    try {
        const community = req.community;
        const logs = await ModerationLog.find({ community: community._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("moderator", "username")
            .populate("targetUser", "username");

        const userIds = new Set();
        logs.forEach((log) => {
            if (log.moderator?._id) userIds.add(log.moderator._id.toString());
            if (log.targetUser?._id) userIds.add(log.targetUser._id.toString());
        });

        const profiles = await Profile.find({ userId: { $in: Array.from(userIds) } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const results = logs.map((log) => {
            const modId = log.moderator?._id?.toString();
            const targetId = log.targetUser?._id?.toString();
            const modProf = modId ? profileMap.get(modId) : null;
            const targetProf = targetId ? profileMap.get(targetId) : null;

            return {
                _id: log._id,
                action: log.action,
                reason: log.reason,
                metadata: log.metadata,
                createdAt: log.createdAt,
                moderator: log.moderator
                    ? {
                          _id: log.moderator._id,
                          username: log.moderator.username || modProf?.username || "moderator",
                          displayName: modProf?.displayName || log.moderator.username || "Moderator",
                          avatar: modProf?.avatar || ""
                      }
                    : null,
                targetUser: log.targetUser
                    ? {
                          _id: log.targetUser._id,
                          username: log.targetUser.username || targetProf?.username || "user",
                          displayName: targetProf?.displayName || log.targetUser.username || "User",
                          avatar: targetProf?.avatar || ""
                      }
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            count: results.length,
            logs: results
        });
    } catch (error) {
        console.error("getModerationLogs error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Submit Community Report.
 */
const createCommunityReport = async (req, res) => {
    try {
        const community = req.community;
        const { targetUserId, targetMessageId, targetMeetingRoomId, reason, details } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: "Report reason is required" });
        }

        const report = await CommunityReport.create({
            community: community._id,
            reporter: req.user._id,
            targetUser: targetUserId || null,
            targetMessage: targetMessageId || null,
            targetMeetingRoom: targetMeetingRoomId || null,
            reason: reason.trim(),
            details: (details || "").trim(),
            status: "PENDING"
        });

        return res.status(201).json({
            success: true,
            message: "Report submitted to community moderators",
            report
        });
    } catch (error) {
        console.error("createCommunityReport error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get Community Reports (Owner or Moderator).
 */
const getCommunityReports = async (req, res) => {
    try {
        const community = req.community;
        const { status } = req.query;

        const filter = { community: community._id };
        if (status && status !== "ALL") {
            filter.status = status.toUpperCase();
        }

        const reports = await CommunityReport.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .populate("reporter", "username")
            .populate("targetUser", "username")
            .populate("resolvedBy", "username");

        const userIds = new Set();
        reports.forEach((r) => {
            if (r.reporter?._id) userIds.add(r.reporter._id.toString());
            if (r.targetUser?._id) userIds.add(r.targetUser._id.toString());
            if (r.resolvedBy?._id) userIds.add(r.resolvedBy._id.toString());
        });

        const profiles = await Profile.find({ userId: { $in: Array.from(userIds) } });
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const results = reports.map((r) => {
            const repProf = r.reporter ? profileMap.get(r.reporter._id.toString()) : null;
            const targetProf = r.targetUser ? profileMap.get(r.targetUser._id.toString()) : null;
            const resProf = r.resolvedBy ? profileMap.get(r.resolvedBy._id.toString()) : null;

            return {
                _id: r._id,
                reason: r.reason,
                details: r.details,
                status: r.status,
                resolutionNotes: r.resolutionNotes,
                createdAt: r.createdAt,
                resolvedAt: r.resolvedAt,
                reporter: r.reporter
                    ? {
                          _id: r.reporter._id,
                          username: r.reporter.username || repProf?.username || "reporter",
                          displayName: repProf?.displayName || r.reporter.username || "Reporter",
                          avatar: repProf?.avatar || ""
                      }
                    : null,
                targetUser: r.targetUser
                    ? {
                          _id: r.targetUser._id,
                          username: r.targetUser.username || targetProf?.username || "user",
                          displayName: targetProf?.displayName || r.targetUser.username || "User",
                          avatar: targetProf?.avatar || ""
                      }
                    : null,
                resolvedBy: r.resolvedBy
                    ? {
                          _id: r.resolvedBy._id,
                          username: r.resolvedBy.username || resProf?.username || "moderator",
                          displayName: resProf?.displayName || r.resolvedBy.username || "Moderator"
                      }
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            count: results.length,
            reports: results
        });
    } catch (error) {
        console.error("getCommunityReports error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Resolve Community Report (Owner or Moderator).
 */
const resolveCommunityReport = async (req, res) => {
    try {
        const community = req.community;
        const { reportId } = req.params;
        const { status, resolutionNotes } = req.body;

        const report = await CommunityReport.findOne({ _id: reportId, community: community._id });
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found" });
        }

        const validStatus = status === "RESOLVED" || status === "DISMISSED" ? status : "RESOLVED";
        report.status = validStatus;
        report.resolvedBy = req.user._id;
        report.resolvedAt = new Date();
        report.resolutionNotes = resolutionNotes || "";
        await report.save();

        await ModerationLog.create({
            community: community._id,
            moderator: req.user._id,
            targetUser: report.targetUser,
            action: validStatus === "RESOLVED" ? "RESOLVE_REPORT" : "DISMISS_REPORT",
            reason: resolutionNotes || `Report ${validStatus.toLowerCase()}`,
            metadata: { reportId: report._id, reportReason: report.reason }
        }).catch((e) => console.warn("ModerationLog error:", e));

        return res.status(200).json({
            success: true,
            message: `Report ${validStatus.toLowerCase()} successfully`,
            report
        });
    } catch (error) {
        console.error("resolveCommunityReport error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Boost Community (Requires Pro!).
 */
const boostCommunity = async (req, res) => {
    try {
        const community = req.community;
        const userId = req.user._id;

        // Check if user has an active boost on this community
        const existingBoost = await CommunityBoost.findOne({
            community: community._id,
            booster: userId,
            status: "ACTIVE"
        });

        if (existingBoost) {
            return res.status(400).json({
                success: false,
                message: "You have already boosted this community! Your boost is active for 30 days."
            });
        }

        // Create boost record
        const boost = await CommunityBoost.create({
            community: community._id,
            booster: userId,
            boostedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "ACTIVE"
        });

        community.boostCount = (community.boostCount || 0) + 1;
        community.updateBoostLevel();
        await community.save();

        return res.status(200).json({
            success: true,
            message: `🚀 Boosted ${community.name}! Current Level: ${community.boostLevel}`,
            boost,
            boostCount: community.boostCount,
            boostLevel: community.boostLevel,
            isBoosted: community.isBoosted
        });
    } catch (error) {
        console.error("boostCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * List active boosters of a community.
 */
const getBoosters = async (req, res) => {
    try {
        const community = req.community;
        const boosts = await CommunityBoost.find({ community: community._id, status: "ACTIVE" })
            .sort({ boostedAt: -1 })
            .populate("booster", "username");

        const boosterProfiles = await Profile.find({
            userId: { $in: boosts.map((b) => b.booster?._id).filter(Boolean) }
        });

        const profileMap = new Map(boosterProfiles.map((p) => [p.userId.toString(), p]));

        const results = boosts.map((b) => {
            const p = b.booster ? profileMap.get(b.booster._id.toString()) : null;
            return {
                _id: b._id,
                boostedAt: b.boostedAt,
                booster: {
                    _id: b.booster?._id,
                    username: b.booster?.username || p?.username || "unknown",
                    displayName: p?.displayName || b.booster?.username || "Unknown",
                    avatar: p?.avatar || "",
                    isPro: p?.isPro || false,
                    avatarDecoration: p?.avatarDecoration || ""
                }
            };
        });

        return res.status(200).json({
            success: true,
            boostCount: community.boostCount,
            boostLevel: community.boostLevel,
            boosters: results
        });
    } catch (error) {
        console.error("getBoosters error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Update Community Active Decorations (Owner only).
 */
const updateCommunityDecorations = async (req, res) => {
    try {
        const community = req.community;
        const { iconFrame, bannerTheme, chatBackground, theme } = req.body;

        const unlocked = new Set(community.unlockedDecorations || []);

        if (iconFrame !== undefined) {
            if (iconFrame && iconFrame !== "" && !unlocked.has(iconFrame)) {
                return res.status(403).json({ success: false, message: "This icon frame is locked for this community" });
            }
            community.activeDecorations.iconFrame = iconFrame;
        }

        if (bannerTheme !== undefined) {
            if (bannerTheme && bannerTheme !== "" && !unlocked.has(bannerTheme)) {
                return res.status(403).json({ success: false, message: "This banner theme is locked for this community" });
            }
            community.activeDecorations.bannerTheme = bannerTheme;
        }

        if (chatBackground !== undefined) {
            community.activeDecorations.chatBackground = chatBackground;
        }

        if (theme !== undefined) {
            if (theme && theme !== "default" && !unlocked.has(theme)) {
                return res.status(403).json({ success: false, message: "This theme is locked for this community" });
            }
            community.activeDecorations.theme = theme;
        }

        await community.save();

        return res.status(200).json({
            success: true,
            message: "Community decorations updated!",
            activeDecorations: community.activeDecorations
        });
    } catch (error) {
        console.error("updateCommunityDecorations error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Unlock Community Decoration (Owner only, mock purchase).
 */
const unlockCommunityDecoration = async (req, res) => {
    try {
        const community = req.community;
        const { decorationId } = req.body;

        if (!decorationId) {
            return res.status(400).json({ success: false, message: "Decoration ID required" });
        }

        const item = findItemById(decorationId);
        if (!item || item.type !== "COMMUNITY_DECORATION") {
            return res.status(404).json({ success: false, message: "Community decoration not found" });
        }

        if (!community.unlockedDecorations.includes(decorationId)) {
            community.unlockedDecorations.push(decorationId);
            await community.save();
        }

        return res.status(200).json({
            success: true,
            message: `Unlocked ${item.name} for ${community.name}!`,
            unlockedDecorations: community.unlockedDecorations
        });
    } catch (error) {
        console.error("unlockCommunityDecoration error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    getCommunities,
    getCommunity,
    createCommunity,
    updateCommunity,
    joinCommunity,
    leaveCommunity,
    addModerator,
    removeModerator,
    removeMember,
    banCommunityMember,
    unbanCommunityMember,
    getBannedMembers,
    getCommunityMembers,
    getModerationLogs,
    createCommunityReport,
    getCommunityReports,
    resolveCommunityReport,
    boostCommunity,
    getBoosters,
    updateCommunityDecorations,
    unlockCommunityDecoration
};
