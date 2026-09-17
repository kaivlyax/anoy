const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Follow = require("../models/Follow");
const Profile = require("../models/Profile");
// =====================================================
// CREATE POST
// =====================================================

const createPost = async (req, res) => {

    try {

        const {
            content,
            media,
            visibility
        } = req.body;


        // Create the post
        const post = await Post.create({

            author: req.user._id,

            content: content || "",

            media: media || [],

            visibility: visibility || "PUBLIC"

        });


        return res.status(201).json({

            success: true,

            message: "Post created successfully",

            post

        });

    } catch (error) {

        console.error(
            "Create post error:",
            error
        );


        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

// =====================================================
// GET POSTS / FEED
// =====================================================

const getPosts = async (req, res) => {

    try {

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit) || 20,
                1
            ),
            100
        );

        const skip = (page - 1) * limit;


        const total = await Post.countDocuments({

            isDeleted: false,

            visibility: "PUBLIC"

        });


        const posts = await Post.find({

            isDeleted: false,

            visibility: "PUBLIC"

        })

        .populate(
            "author",
            "username"
        )

        .sort({
            createdAt: -1
        })

        .skip(skip)

        .limit(limit);


        // Pre-fetch author profiles for avatar & badge hydration
        const authorProfiles = await Profile.find({
            userId: { $in: posts.map((p) => p.author?._id).filter(Boolean) }
        });
        const profileMap = new Map(authorProfiles.map((p) => [p.userId.toString(), p]));

        const postsWithDetails = await Promise.all(
            posts.map(async (post) => {
                const likeCount = await Like.countDocuments({ post: post._id });
                const existingLike = await Like.findOne({ post: post._id, user: req.user._id });
                const commentCount = await Comment.countDocuments({ post: post._id, isDeleted: false });

                const p = post.author ? profileMap.get(post.author._id.toString()) : null;
                const authorData = post.author
                    ? {
                          ...post.author.toObject(),
                          displayName: p?.displayName || post.author.username,
                          avatar: p?.avatar || "",
                          isPro: p?.isPro || false,
                          avatarDecoration: p?.avatarDecoration || ""
                      }
                    : null;

                return {
                    ...post.toObject(),
                    author: authorData,
                    likeCount,
                    isLiked: existingLike !== null,
                    commentCount
                };
            })
        );


        return res.status(200).json({

            success: true,

            count: postsWithDetails.length,

            page,

            limit,

            total,

            totalPages:
                Math.ceil(total / limit),

            posts: postsWithDetails

        });

    } catch (error) {

        console.error(
            "Get posts error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};
// =====================================================
// GET SINGLE POST
// =====================================================

const getPostById = async (req, res) => {

    try {

        const post =
            await Post.findOne({

                _id: req.params.id,

                isDeleted: false

            })

            .populate(
                "author",
                "username"
            );


        if (!post) {

            return res.status(404).json({

                success: false,

                message: "Post not found"

            });

        }


        // For now, only allow public posts
        if (post.visibility !== "PUBLIC") {

            return res.status(403).json({

                success: false,

                message:
                    "You do not have permission to view this post"

            });

        }


        return res.status(200).json({

            success: true,

            post

        });

    } catch (error) {

        console.error(
            "Get post error:",
            error
        );


        // Invalid MongoDB ObjectId
        if (error.name === "CastError") {

            return res.status(400).json({

                success: false,

                message: "Invalid post ID"

            });

        }


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =====================================================
// UPDATE POST
// =====================================================

const updatePost = async (req, res) => {

    try {

        const post =
            await Post.findOne({

                _id: req.params.id,

                isDeleted: false

            });


        if (!post) {

            return res.status(404).json({

                success: false,

                message: "Post not found"

            });

        }


        // Only the author can edit the post

        if (
            post.author.toString() !==
            req.user._id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only edit your own post"

            });

        }


        const {
            content,
            media,
            visibility
        } = req.body;


        // Update only provided fields

        if (content !== undefined) {

            post.content = content;

        }


        if (media !== undefined) {

            post.media = media;

        }


        if (visibility !== undefined) {

            post.visibility = visibility;

        }


        await post.save();


        return res.status(200).json({

            success: true,

            message: "Post updated successfully",

            post

        });

    } catch (error) {

        console.error(
            "Update post error:",
            error
        );


        if (error.name === "CastError") {

            return res.status(400).json({

                success: false,

                message: "Invalid post ID"

            });

        }


        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

// =====================================================
// DELETE POST (SOFT DELETE)
// =====================================================

const deletePost = async (req, res) => {

    try {

        const post =
            await Post.findOne({

                _id: req.params.id,

                isDeleted: false

            });


        if (!post) {

            return res.status(404).json({

                success: false,

                message: "Post not found"

            });

        }


        // Only the author can delete the post

        if (
            post.author.toString() !==
            req.user._id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only delete your own post"

            });

        }


        // Soft delete

        post.isDeleted = true;

        await post.save();


        return res.status(200).json({

            success: true,

            message: "Post deleted successfully"

        });

    } catch (error) {

        console.error(
            "Delete post error:",
            error
        );


        if (error.name === "CastError") {

            return res.status(400).json({

                success: false,

                message: "Invalid post ID"

            });

        }


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =====================================================
// GET PERSONALIZED FEED
// =====================================================

const getPersonalizedFeed = async (req, res) => {

    try {

        // =========================
        // PAGINATION
        // =========================

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit) || 10,
                1
            ),
            100
        );

        const skip = (page - 1) * limit;


        // =========================
        // FIND USERS I FOLLOW
        // =========================

        const following = await Follow.find({

            follower: req.user._id,

            status: "ACCEPTED"

        }).select("following");


        // Extract followed user IDs

        const followingIds =
            following.map((relationship) =>
                relationship.following
            );


        // Add my own ID

        followingIds.push(req.user._id);


        // =========================
        // FIND POSTS
        // =========================

        const total = await Post.countDocuments({

            author: {
                $in: followingIds
            },

            isDeleted: false

        });


        const posts = await Post.find({

            author: {
                $in: followingIds
            },

            isDeleted: false

        })

        .populate(
            "author",
            "username"
        )

        .sort({
            createdAt: -1
        })

        .skip(skip)

        .limit(limit);


        // =========================
        // ADD LIKE + COMMENT DETAILS & AUTHOR PROFILE
        // =========================

        const authorProfiles = await Profile.find({
            userId: { $in: posts.map((p) => p.author?._id).filter(Boolean) }
        });
        const profileMap = new Map(authorProfiles.map((p) => [p.userId.toString(), p]));

        const postsWithDetails =
            await Promise.all(

                posts.map(async (post) => {

                    const likeCount =
                        await Like.countDocuments({

                            post: post._id

                        });


                    const existingLike =
                        await Like.findOne({

                            post: post._id,

                            user: req.user._id

                        });


                    const commentCount =
                        await Comment.countDocuments({

                            post: post._id,

                            isDeleted: false

                        });

                    const p = post.author ? profileMap.get(post.author._id.toString()) : null;
                    const authorData = post.author
                        ? {
                              ...post.author.toObject(),
                              displayName: p?.displayName || post.author.username,
                              avatar: p?.avatar || "",
                              isPro: p?.isPro || false,
                              avatarDecoration: p?.avatarDecoration || ""
                          }
                        : null;

                    return {

                        ...post.toObject(),

                        author: authorData,

                        likeCount,

                        isLiked:
                            existingLike !== null,

                        commentCount

                    };

                })

            );


        // =========================
        // RESPONSE
        // =========================

        return res.status(200).json({

            success: true,

            count:
                postsWithDetails.length,

            page,

            limit,

            total,

            totalPages:
                Math.ceil(total / limit),

            posts:
                postsWithDetails

        });


    } catch (error) {

        console.error(
            "Get personalized feed error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};


// =====================================================
// GET TRENDING TOPICS
// =====================================================
const getTrendingTopics = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 30);
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);

        const timeBoundary = new Date();
        timeBoundary.setDate(timeBoundary.getDate() - days);

        // STRICT PRIVACY: Only public, non-deleted posts with non-empty content
        const publicPosts = await Post.find({
            isDeleted: false,
            visibility: "PUBLIC",
            content: { $exists: true, $ne: "" },
            createdAt: { $gte: timeBoundary }
        })
            .select("_id content createdAt")
            .sort({ createdAt: -1 })
            .limit(500);

        if (!publicPosts || publicPosts.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                trending: []
            });
        }

        // Hashtag extraction regex supporting letters, digits, underscores, and unicode
        const hashtagRegex = /(?:^|\s)(#[a-zA-Z0-9_\u0900-\u097F]+)/g;

        // Grouping map for extracted topics
        const topicMap = new Map();

        publicPosts.forEach((post) => {
            const matches = post.content.match(hashtagRegex);
            if (!matches) return;

            const uniqueTagsInPost = new Set();
            matches.forEach((m) => {
                const cleaned = m.trim().replace(/[.,!?:;]+$/, "");
                if (cleaned.length > 1) {
                    uniqueTagsInPost.add(cleaned);
                }
            });

            uniqueTagsInPost.forEach((rawTag) => {
                const normalized = rawTag.toLowerCase();
                if (!topicMap.has(normalized)) {
                    topicMap.set(normalized, {
                        tag: rawTag,
                        topic: rawTag,
                        postIds: new Set([post._id.toString()]),
                        latestDate: post.createdAt,
                        posts: [{ id: post._id, createdAt: post.createdAt }]
                    });
                } else {
                    const entry = topicMap.get(normalized);
                    entry.postIds.add(post._id.toString());
                    entry.posts.push({ id: post._id, createdAt: post.createdAt });
                    if (post.createdAt > entry.latestDate) {
                        entry.latestDate = post.createdAt;
                        entry.tag = rawTag;
                        entry.topic = rawTag;
                    }
                }
            });
        });

        if (topicMap.size === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                trending: []
            });
        }

        // Gather all relevant postIds across all extracted topics to query likes & comments
        const allPostIds = [];
        topicMap.forEach((entry) => {
            entry.postIds.forEach((pid) => allPostIds.push(pid));
        });
        const uniquePostIds = Array.from(new Set(allPostIds));

        // Aggregate likes and comments on these public posts
        const [likes, comments] = await Promise.all([
            Like.find({ post: { $in: uniquePostIds } }).select("post"),
            Comment.find({ post: { $in: uniquePostIds }, isDeleted: false }).select("post")
        ]);

        const likeCounts = new Map();
        likes.forEach((l) => {
            const pid = l.post.toString();
            likeCounts.set(pid, (likeCounts.get(pid) || 0) + 1);
        });

        const commentCounts = new Map();
        comments.forEach((c) => {
            const pid = c.post.toString();
            commentCounts.set(pid, (commentCounts.get(pid) || 0) + 1);
        });

        const now = Date.now();

        // Calculate score for each topic
        const scoredTopics = Array.from(topicMap.values()).map((entry) => {
            const postCount = entry.postIds.size;
            let totalLikes = 0;
            let totalComments = 0;
            let totalRecencyWeight = 0;

            entry.posts.forEach((p) => {
                const pid = p.id.toString();
                totalLikes += likeCounts.get(pid) || 0;
                totalComments += commentCounts.get(pid) || 0;

                const ageHours = Math.max((now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60), 0);
                totalRecencyWeight += 1 / (1 + ageHours / 24);
            });

            const engagement = totalLikes + totalComments;
            const score = Math.round((postCount * 3 + totalLikes * 1.5 + totalComments * 2.5 + totalRecencyWeight * 2) * 10) / 10;

            return {
                tag: entry.tag,
                topic: entry.topic,
                postCount,
                likeCount: totalLikes,
                commentCount: totalComments,
                engagement,
                score
            };
        });

        // Sort descending by score, then by postCount, then engagement
        scoredTopics.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.postCount !== a.postCount) return b.postCount - a.postCount;
            return b.engagement - a.engagement;
        });

        const topTrending = scoredTopics.slice(0, limit);

        return res.status(200).json({
            success: true,
            count: topTrending.length,
            trending: topTrending
        });
    } catch (error) {
        console.error("Get trending topics error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error calculating trending topics"
        });
    }
};

module.exports = {
    createPost,
    getPosts,
    getPostById,
    updatePost,
    deletePost,
    getPersonalizedFeed,
    getTrendingTopics
};