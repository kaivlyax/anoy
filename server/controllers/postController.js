const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Follow = require("../models/Follow");
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


        // Add like information to every post

        const postsWithDetails = await Promise.all(

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


        return {

            ...post.toObject(),

            likeCount,

            isLiked:
                existingLike !== null,

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
        // ADD LIKE + COMMENT DETAILS
        // =========================

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


                    return {

                        ...post.toObject(),

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


module.exports = {

    createPost,
    getPosts,
    getPostById,
    updatePost,
    deletePost,
    getPersonalizedFeed

};