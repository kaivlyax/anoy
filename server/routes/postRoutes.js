const express = require("express");

const router = express.Router();

const {
    createPost,
    getPosts,
    getPostById,
    updatePost,
    deletePost,
    getPersonalizedFeed
} = require("../controllers/postController");


const {
    likePost,
    unlikePost
} = require("../controllers/likeController");


const {
    createComment,
    getComments,
    updateComment,
    deleteComment
} = require("../controllers/commentController");


const protect =
    require("../middleware/authMiddleware");


// CREATE POST
router.post(
    "/",
    protect,
    createPost
);


// GET FEED
router.get(
    "/",
    protect,
    getPosts
);

// =====================================================
// PERSONALIZED FEED
// =====================================================

router.get(
    "/feed",
    protect,
    getPersonalizedFeed
);


// LIKE POST
router.post(
    "/:postId/like",
    protect,
    likePost
);


// UNLIKE POST
router.delete(
    "/:postId/like",
    protect,
    unlikePost
);

// COMMENT
router.post(
    "/:postId/comments",
    protect,
    createComment
);

router.get(
    "/:postId/comments",
    getComments
);

router.patch(
    "/comments/:id",
    protect,
    updateComment
);

router.delete(
    "/comments/:id",
    protect,
    deleteComment
);

// GET SINGLE POST
router.get(
    "/:id",
    getPostById
);


// UPDATE POST
router.patch(
    "/:id",
    protect,
    updatePost
);


// DELETE POST
router.delete(
    "/:id",
    protect,
    deletePost
);


module.exports = router;