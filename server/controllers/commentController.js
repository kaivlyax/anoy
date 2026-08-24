const Comment = require("../models/Comment");
const Post = require("../models/Post");


// =====================================================
// CREATE COMMENT
// =====================================================

const createComment = async (req, res) => {

    try {

        const { postId } = req.params;

        const { content } = req.body;


        // Validate comment content

        if (!content || !content.trim()) {

            return res.status(400).json({

                success: false,

                message: "Comment content is required"

            });

        }


        // Check whether the post exists

        const post = await Post.findOne({

            _id: postId,

            isDeleted: false

        });


        if (!post) {

            return res.status(404).json({

                success: false,

                message: "Post not found"

            });

        }


        // Create comment

        const comment = await Comment.create({

            author: req.user._id,

            post: postId,

            content: content.trim()

        });


        return res.status(201).json({

            success: true,

            message: "Comment created successfully",

            comment

        });

    } catch (error) {

        console.error(
            "Create comment error:",
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
// GET COMMENTS FOR A POST
// =====================================================

const getComments = async (req, res) => {

    try {

        const { postId } = req.params;


        // Check whether the post exists

        const post = await Post.findOne({

            _id: postId,

            isDeleted: false

        });


        if (!post) {

            return res.status(404).json({

                success: false,

                message: "Post not found"

            });

        }


        // Get active comments

        const comments = await Comment.find({

            post: postId,

            isDeleted: false

        })

        .populate(
            "author",
            "username"
        )

        .sort({
            createdAt: -1
        });


        return res.status(200).json({

            success: true,

            count: comments.length,

            comments

        });

    } catch (error) {

        console.error(
            "Get comments error:",
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
// UPDATE COMMENT
// =====================================================

const updateComment = async (req, res) => {

    try {

        const { id } = req.params;
        const { content } = req.body;


        // Validate content

        if (!content || !content.trim()) {

            return res.status(400).json({

                success: false,

                message: "Comment content is required"

            });

        }


        // Find active comment

        const comment =
            await Comment.findOne({

                _id: id,

                isDeleted: false

            });


        if (!comment) {

            return res.status(404).json({

                success: false,

                message: "Comment not found"

            });

        }


        // Only author can edit

        if (
            comment.author.toString() !==
            req.user._id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only edit your own comment"

            });

        }


        comment.content = content.trim();

        await comment.save();


        return res.status(200).json({

            success: true,

            message: "Comment updated successfully",

            comment

        });

    } catch (error) {

        console.error(
            "Update comment error:",
            error
        );


        if (error.name === "CastError") {

            return res.status(400).json({

                success: false,

                message: "Invalid comment ID"

            });

        }


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =====================================================
// DELETE COMMENT (SOFT DELETE)
// =====================================================

const deleteComment = async (req, res) => {

    try {

        const { id } = req.params;


        // Find active comment

        const comment =
            await Comment.findOne({

                _id: id,

                isDeleted: false

            });


        if (!comment) {

            return res.status(404).json({

                success: false,

                message: "Comment not found"

            });

        }


        // Only author can delete

        if (
            comment.author.toString() !==
            req.user._id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only delete your own comment"

            });

        }


        // Soft delete

        comment.isDeleted = true;

        await comment.save();


        return res.status(200).json({

            success: true,

            message: "Comment deleted successfully"

        });

    } catch (error) {

        console.error(
            "Delete comment error:",
            error
        );


        if (error.name === "CastError") {

            return res.status(400).json({

                success: false,

                message: "Invalid comment ID"

            });

        }


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};


module.exports = {
    createComment,
    getComments,
    updateComment,
    deleteComment
};