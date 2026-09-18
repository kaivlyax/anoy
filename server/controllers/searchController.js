const Profile = require("../models/Profile");
const Identity = require("../models/Identity");
const Community = require("../models/Community");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");

// =====================================================
// SEARCH USERS / PEOPLE
// =====================================================
const searchUsers = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || !query.trim()) {
            return res.status(200).json({
                success: true,
                count: 0,
                users: []
            });
        }

        const searchTerm = query.trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const users = await Profile.find({
            privacy: "PUBLIC",
            userId: { $nin: deletedUserIds },
            $or: [
                { username: { $regex: searchTerm, $options: "i" } },
                { displayName: { $regex: searchTerm, $options: "i" } },
                { skills: { $regex: searchTerm, $options: "i" } },
                { interests: { $regex: searchTerm, $options: "i" } }
            ]
        })
            .select("username displayName bio avatar coverImage skills interests privacy isPro avatarDecoration")
            .limit(limit);

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error("Search users error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error searching users"
        });
    }
};

// =====================================================
// SEARCH COMMUNITIES
// =====================================================
const searchCommunities = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || !query.trim()) {
            return res.status(200).json({
                success: true,
                count: 0,
                communities: []
            });
        }

        const searchTerm = query.trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const communities = await Community.find({
            $or: [
                { name: { $regex: searchTerm, $options: "i" } },
                { slug: { $regex: searchTerm, $options: "i" } },
                { description: { $regex: searchTerm, $options: "i" } }
            ]
        })
            .populate("owner", "username")
            .limit(limit);

        const formatted = communities.map((comm) => ({
            _id: comm._id,
            name: comm.name,
            slug: comm.slug,
            description: comm.description,
            avatar: comm.avatar,
            coverImage: comm.coverImage,
            isPrivate: comm.isPrivate,
            memberCount: comm.members?.length || 0,
            boostCount: comm.boostCount || 0,
            isBoosted: comm.isBoosted || false,
            owner: comm.owner ? { _id: comm.owner._id, username: comm.owner.username } : null
        }));

        return res.status(200).json({
            success: true,
            count: formatted.length,
            communities: formatted
        });
    } catch (error) {
        console.error("Search communities error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error searching communities"
        });
    }
};

// =====================================================
// SEARCH POSTS
// =====================================================
const searchPosts = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || !query.trim()) {
            return res.status(200).json({
                success: true,
                count: 0,
                posts: []
            });
        }

        const searchTerm = query.trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const posts = await Post.find({
            isDeleted: false,
            visibility: "PUBLIC",
            content: { $regex: searchTerm, $options: "i" }
        })
            .populate("author", "username")
            .sort({ createdAt: -1 })
            .limit(limit);

        // Pre-fetch author profiles, like counts, and comment counts
        const authorIds = Array.from(new Set(posts.map((p) => p.author?._id?.toString()).filter(Boolean)));
        const postIds = posts.map((p) => p._id);

        const [profiles, likes, comments] = await Promise.all([
            Profile.find({ userId: { $in: authorIds } }),
            Like.find({ post: { $in: postIds } }),
            Comment.find({ post: { $in: postIds }, isDeleted: false })
        ]);

        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
        const likeCountMap = new Map();
        likes.forEach((l) => {
            const pid = l.post.toString();
            likeCountMap.set(pid, (likeCountMap.get(pid) || 0) + 1);
        });

        const commentCountMap = new Map();
        comments.forEach((c) => {
            const pid = c.post.toString();
            commentCountMap.set(pid, (commentCountMap.get(pid) || 0) + 1);
        });

        const formattedPosts = posts.map((post) => {
            const prof = post.author ? profileMap.get(post.author._id.toString()) : null;
            return {
                _id: post._id,
                content: post.content,
                media: post.media,
                visibility: post.visibility,
                createdAt: post.createdAt,
                author: post.author
                    ? {
                          _id: post.author._id,
                          username: post.author.username,
                          displayName: prof?.displayName || post.author.username,
                          avatar: prof?.avatar || "",
                          isPro: prof?.isPro || false,
                          avatarDecoration: prof?.avatarDecoration || ""
                      }
                    : null,
                likesCount: likeCountMap.get(post._id.toString()) || 0,
                commentsCount: commentCountMap.get(post._id.toString()) || 0
            };
        });

        return res.status(200).json({
            success: true,
            count: formattedPosts.length,
            posts: formattedPosts
        });
    } catch (error) {
        console.error("Search posts error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error searching posts"
        });
    }
};

// =====================================================
// UNIFIED SEARCH
// =====================================================
const unifiedSearch = async (req, res) => {
    try {
        const query = req.query.q;
        const type = req.query.type || "all";

        if (!query || !query.trim()) {
            return res.status(200).json({
                success: true,
                query: "",
                users: [],
                communities: [],
                posts: []
            });
        }

        const searchTerm = query.trim();

        if (type === "users") {
            return searchUsers(req, res);
        }
        if (type === "communities") {
            return searchCommunities(req, res);
        }
        if (type === "posts") {
            return searchPosts(req, res);
        }

        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        // Parallel execution for 'all'
        const [usersRes, commsRes, postsRes] = await Promise.all([
            Profile.find({
                privacy: "PUBLIC",
                userId: { $nin: deletedUserIds },
                $or: [
                    { username: { $regex: searchTerm, $options: "i" } },
                    { displayName: { $regex: searchTerm, $options: "i" } }
                ]
            })
                .select("username displayName bio avatar skills interests isPro avatarDecoration")
                .limit(10),

            Community.find({
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { slug: { $regex: searchTerm, $options: "i" } }
                ]
            })
                .populate("owner", "username")
                .limit(10),

            Post.find({
                isDeleted: false,
                visibility: "PUBLIC",
                content: { $regex: searchTerm, $options: "i" }
            })
                .populate("author", "username")
                .limit(10)
        ]);

        return res.status(200).json({
            success: true,
            query: searchTerm,
            users: usersRes,
            communities: commsRes.map((c) => ({
                _id: c._id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                avatar: c.avatar,
                isPrivate: c.isPrivate,
                memberCount: c.members?.length || 0
            })),
            posts: postsRes
        });
    } catch (error) {
        console.error("Unified search error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error performing search"
        });
    }
};

module.exports = {
    searchUsers,
    searchCommunities,
    searchPosts,
    unifiedSearch
};