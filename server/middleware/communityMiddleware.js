const Community = require("../models/Community");

/**
 * Loads community document from params (:id, :slug, or :slugOrId) and attaches to req.community.
 */
const loadCommunity = async (req, res) => {
    const identifier = req.params.id || req.params.slug || req.params.slugOrId || req.body.communityId;
    if (!identifier) {
        res.status(400).json({ success: false, message: "Community identifier required" });
        return null;
    }

    let community;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        community = await Community.findById(identifier);
    }
    if (!community) {
        community = await Community.findOne({ slug: identifier.toLowerCase().trim() });
    }

    if (!community) {
        res.status(404).json({ success: false, message: "Community not found" });
        return null;
    }

    req.community = community;
    return community;
};

/**
 * Middleware: Attaches community to req.community without role checks.
 */
const attachCommunity = async (req, res, next) => {
    try {
        const community = await loadCommunity(req, res);
        if (!community) return;
        next();
    } catch (error) {
        console.error("attachCommunity error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Middleware: Requires the authenticated user to be the OWNER of the target community.
 */
const requireCommunityOwner = async (req, res, next) => {
    try {
        const community = await loadCommunity(req, res);
        if (!community) return;

        if (!req.user || !community.owner.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Only the community owner has permission to perform this action"
            });
        }

        next();
    } catch (error) {
        console.error("requireCommunityOwner error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Middleware: Requires the authenticated user to be either the OWNER or a MODERATOR.
 */
const requireCommunityModerator = async (req, res, next) => {
    try {
        const community = await loadCommunity(req, res);
        if (!community) return;

        const isOwner = req.user && community.owner.equals(req.user._id);
        const isMod = req.user && community.moderators.some((modId) => modId.equals(req.user._id));

        if (!isOwner && !isMod) {
            return res.status(403).json({
                success: false,
                message: "Moderator or Owner permissions required"
            });
        }

        req.isOwner = isOwner;
        req.isModerator = isMod;
        next();
    } catch (error) {
        console.error("requireCommunityModerator error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Middleware: Requires the authenticated user to be an active member, moderator, or owner.
 */
const requireCommunityMember = async (req, res, next) => {
    try {
        const community = await loadCommunity(req, res);
        if (!community) return;

        const isBanned = req.user && community.bannedUsers?.some((b) => (b.user?._id ? b.user._id.equals(req.user._id) : b.user?.equals?.(req.user._id)));
        if (isBanned) {
            return res.status(403).json({
                success: false,
                message: "You are banned from this community"
            });
        }

        const isOwner = req.user && community.owner.equals(req.user._id);
        const isMod = req.user && community.moderators.some((modId) => modId.equals(req.user._id));
        const isMember = req.user && community.members.some((memberId) => memberId.equals(req.user._id));

        if (!isOwner && !isMod && !isMember) {
            return res.status(403).json({
                success: false,
                message: "You must join this community to perform this action"
            });
        }

        req.isOwner = isOwner;
        req.isModerator = isMod;
        req.isMember = isMember;
        next();
    } catch (error) {
        console.error("requireCommunityMember error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    loadCommunity,
    attachCommunity,
    requireCommunityOwner,
    requireCommunityModerator,
    requireCommunityMember
};
