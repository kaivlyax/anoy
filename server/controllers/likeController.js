const Like = require("../models/Like");
const Post = require("../models/Post");


// =====================================================
// LIKE POST
// =====================================================

const likePost = async (req, res) => {

    try {

        const { postId } = req.params;


        // Check if post exists and is not deleted

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


        // Check if already liked

        const existingLike =
            await Like.findOne({

                user: req.user._id,

                post: postId

            });


        if (existingLike) {

            return res.status(409).json({

                success: false,

                message: "Post already liked"

            });

        }


        // Create like

        await Like.create({

            user: req.user._id,

            post: postId

        });


        return res.status(201).json({

            success: true,

            message: "Post liked successfully"

        });

    } catch (error) {

        console.error(
            "Like post error:",
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
// UNLIKE POST
// =====================================================

const unlikePost = async (req, res) => {

    try {

        const { postId } = req.params;


        const like =
            await Like.findOneAndDelete({

                user: req.user._id,

                post: postId

            });


        if (!like) {

            return res.status(404).json({

                success: false,

                message: "Like not found"

            });

        }


        return res.status(200).json({

            success: true,

            message: "Post unliked successfully"

        });

    } catch (error) {

        console.error(
            "Unlike post error:",
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


module.exports = {

    likePost,
    unlikePost

};