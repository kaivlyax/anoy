const Community = require("../models/Community");
const CommunityBoost = require("../models/CommunityBoost");
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
        const ownerIdentity = await Identity.findById(community.owner);
        const ownerProfile = await Profile.findOne({ userId: community.owner });

        const modProfiles = await Profile.find({ userId: { $in: community.moderators } });
        const memberProfiles = await Profile.find({ userId: { $in: community.members } }).limit(20);

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
                owner: {
                    _id: community.owner,
                    username: ownerIdentity?.username || ownerProfile?.username || "unknown",
                    displayName: ownerProfile?.displayName || ownerIdentity?.username || "Unknown",
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
                memberCount: community.members?.length || 0,
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
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: "Target user ID required" });
        }

        const targetUser = await Identity.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }

        if (!community.members.some((m) => m.equals(targetUser._id))) {
            community.members.push(targetUser._id);
        }

        if (!community.moderators.some((m) => m.equals(targetUser._id))) {
            community.moderators.push(targetUser._id);
        }

        await community.save();

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
    boostCommunity,
    getBoosters,
    updateCommunityDecorations,
    unlockCommunityDecoration
};
