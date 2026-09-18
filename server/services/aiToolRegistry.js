const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const Post = require("../models/Post");

/**
 * Verified ANOY Platform Feature Documentation Knowledge Base
 */
const ANOY_KNOWLEDGE = {
    overview: `ANOY is a modern social and community networking platform designed for university students. Key features include Public/Private Profiles, Post Feeds, Direct Messages, Student Communities with real-time channels, WebRTC Meeting Rooms, and ANOY Pro memberships.`,
    communities: `Communities on ANOY are student hubs organized by interest, course, or university group.
- To create a community: Navigate to the 'Communities' tab and click 'Create Community'. You can set a unique slug, description, and choose Public or Private visibility.
- Membership & Roles: Creators become OWNER; they can promote members to MODERATOR.
- Community Chat: Real-time channel discussions (e.g. #general).
- Boosting: Pro members can boost communities to increase visibility and level perks.`,
    meetingRooms: `Meeting Rooms are live audio/video and screen-sharing collaboration spaces tied directly to communities.
- To create a Meeting Room: Open any community you belong to, go to the 'Meeting Rooms' tab, and click 'Create Room'.
- Security: Rooms can be open or passcode-protected.
- Features: WebRTC mesh video tiles, screen sharing, real-time participant roster, and in-room text chat.`,
    anoyPro: `ANOY Pro is a premium membership tier providing exclusive personalization and perks.
- Perks: Exclusive Pro badge, glowing avatar frames, royal/neon profile themes, animated reaction packs, 25MB HD media uploads (vs 5MB standard), and community boosting.
- Pricing in INR: Monthly (₹99 / month), Annual (₹799 / year - Save 33%), Lifetime VIP (₹2,499 one-time).
- Checkout: Pro purchasing is currently coming soon while the Razorpay application is under review.
    profiles: `Profiles showcase student identities, bio, skills, and academic interests.
- Privacy: Public (visible to everyone on ANOY) or Private (requires follow request approval).
- Customization: Avatars, cover banners, avatar frames, and custom profile themes.`,
    posts: `Posts allow sharing thoughts, questions, and media with the university community.
- Visibility: Public or Followers-only.
- Interactions: Likes, threaded comments, and media lightbox views.`,
    messages: `Direct Messages provide secure 1-to-1 real-time chat between students using Socket.IO with typing indicators and image attachments.`
};

/**
 * Controlled Backend Tool Registry for ANOY AI.
 * Every tool enforces strict data boundary checks and authorization.
 */
const aiToolRegistry = {
    /**
     * Tool 1: Get verified ANOY platform guidance
     */
    getAnoyHelp: async (topic = "") => {
        const t = String(topic).toLowerCase();
        if (t.includes("communit") || t.includes("group") || t.includes("channel")) {
            return { category: "communities", content: ANOY_KNOWLEDGE.communities };
        }
        if (t.includes("meeting") || t.includes("study") || t.includes("room") || t.includes("webrtc") || t.includes("video")) {
            return { category: "meetingRooms", content: ANOY_KNOWLEDGE.meetingRooms };
        }
        if (t.includes("pro") || t.includes("premium") || t.includes("price") || t.includes("plan") || t.includes("razorpay") || t.includes("cost") || t.includes("subscri")) {
            return { category: "anoyPro", content: ANOY_KNOWLEDGE.anoyPro };
        }
        if (t.includes("profile") || t.includes("avatar") || t.includes("privacy") || t.includes("bio") || t.includes("skill")) {
            return { category: "profiles", content: ANOY_KNOWLEDGE.profiles };
        }
        if (t.includes("post") || t.includes("feed") || t.includes("like") || t.includes("comment")) {
            return { category: "posts", content: ANOY_KNOWLEDGE.posts };
        }
        if (t.includes("message") || t.includes("chat") || t.includes("dm")) {
            return { category: "messages", content: ANOY_KNOWLEDGE.messages };
        }
        return { category: "overview", content: ANOY_KNOWLEDGE.overview };
    },

    /**
     * Tool 2: Search Public Student Profiles
     * STRICT SECURITY: Only returns PUBLIC profiles. Excludes emails, password hashes, OTPs, and private fields.
     */
    searchPublicUsers: async (query, limit = 5) => {
        if (!query || !query.trim()) return [];
        const cleanQuery = query.trim();
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 8);

        const users = await Profile.find({
            privacy: "PUBLIC",
            $or: [
                { username: { $regex: cleanQuery, $options: "i" } },
                { displayName: { $regex: cleanQuery, $options: "i" } },
                { skills: { $regex: cleanQuery, $options: "i" } },
                { interests: { $regex: cleanQuery, $options: "i" } }
            ]
        })
            .select("username displayName bio skills interests isPro")
            .limit(safeLimit)
            .lean();

        return users.map((u) => ({
            username: u.username,
            displayName: u.displayName || u.username,
            bio: u.bio ? u.bio.slice(0, 120) : "",
            skills: u.skills || [],
            interests: u.interests || [],
            isPro: Boolean(u.isPro)
        }));
    },

    /**
     * Tool 3: Search Public Communities or Communities the User Has Joined
     */
    searchPublicCommunities: async (query, currentUserId, limit = 5) => {
        if (!query || !query.trim()) return [];
        const cleanQuery = query.trim();
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 8);

        const searchFilter = {
            $or: [
                { name: { $regex: cleanQuery, $options: "i" } },
                { slug: { $regex: cleanQuery, $options: "i" } },
                { description: { $regex: cleanQuery, $options: "i" } }
            ]
        };

        const communities = await Community.find(searchFilter)
            .limit(safeLimit * 2)
            .lean();

        const currentUIdStr = currentUserId ? currentUserId.toString() : "";

        const authorized = communities.filter((comm) => {
            if (!comm.isPrivate) return true;
            if (!currentUIdStr) return false;
            const isOwner = comm.owner?.toString() === currentUIdStr;
            const isMod = comm.moderators?.some((m) => m.toString() === currentUIdStr);
            const isMember = comm.members?.some((m) => m.toString() === currentUIdStr);
            return isOwner || isMod || isMember;
        });

        return authorized.slice(0, safeLimit).map((c) => ({
            id: c._id.toString(),
            name: c.name,
            slug: c.slug,
            description: c.description ? c.description.slice(0, 150) : "",
            isPrivate: Boolean(c.isPrivate),
            memberCount: c.members?.length || 0,
            boostCount: c.boostCount || 0
        }));
    },

    /**
     * Tool 4: Search Public Posts
     * STRICT SECURITY: Only returns non-deleted PUBLIC posts.
     */
    searchPublicPosts: async (query, limit = 5) => {
        if (!query || !query.trim()) return [];
        const cleanQuery = query.trim();
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 8);

        const posts = await Post.find({
            isDeleted: false,
            visibility: "PUBLIC",
            content: { $regex: cleanQuery, $options: "i" }
        })
            .populate("author", "username")
            .sort({ createdAt: -1 })
            .limit(safeLimit)
            .lean();

        return posts.map((p) => ({
            id: p._id.toString(),
            content: p.content ? p.content.slice(0, 150) : "",
            author: p.author?.username || "anonymous",
            createdAt: p.createdAt
        }));
    },

    /**
     * Tool 5: Get Authorized Community Context
     * STRICT SECURITY: Verifies user membership before returning private community details.
     */
    getAuthorizedCommunityContext: async (slugOrId, currentUserId) => {
        if (!slugOrId) return { error: "Community slug or ID required" };

        let community;
        if (mongoose.Types.ObjectId.isValid(slugOrId)) {
            community = await Community.findById(slugOrId).lean();
        }
        if (!community) {
            community = await Community.findOne({ slug: String(slugOrId).toLowerCase().trim() }).lean();
        }

        if (!community) {
            return { error: `Community '${slugOrId}' not found.` };
        }

        const currentUIdStr = currentUserId ? currentUserId.toString() : "";
        const isOwner = community.owner?.toString() === currentUIdStr;
        const isMod = community.moderators?.some((m) => m.toString() === currentUIdStr);
        const isMember = community.members?.some((m) => m.toString() === currentUIdStr);
        const isAuthorized = !community.isPrivate || isOwner || isMod || isMember;

        if (!isAuthorized) {
            return {
                error: "ACCESS_DENIED",
                message: `This is a private community. You must be a member to access its information.`
            };
        }

        return {
            id: community._id.toString(),
            name: community.name,
            slug: community.slug,
            description: community.description || "",
            isPrivate: Boolean(community.isPrivate),
            memberCount: community.members?.length || 0,
            boostCount: community.boostCount || 0,
            userRole: isOwner ? "OWNER" : isMod ? "MODERATOR" : isMember ? "MEMBER" : "VIEWER"
        };
    }
};

module.exports = {
    aiToolRegistry,
    ANOY_KNOWLEDGE
};
