const express = require("express");

const router = express.Router();

const {
    createPost,
    getPosts,
    getPostById,
    updatePost,
    deletePost,
    getPersonalizedFeed,
    getTrendingTopics
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


const protect = require("../middleware/authMiddleware");
const { requireUnrestricted } = require("../middleware/restrictionMiddleware");

// CREATE POST
router.post(
    "/",
    protect,
    requireUnrestricted,
    createPost
);

router.get(
    "/",
    protect,
    getPosts
);

// GET TRENDING TOPICS
router.get(
    "/trending",
    protect,
    getTrendingTopics
);

router.get(
    "/feed",
    protect,
    getPersonalizedFeed
);

router.post(
    "/:postId/like",
    protect,
    requireUnrestricted,
    likePost
);

router.delete(
    "/:postId/like",
    protect,
    requireUnrestricted,
    unlikePost
);

router.post(
    "/:postId/comments",
    protect,
    requireUnrestricted,
    createComment
);

router.get(
    "/:postId/comments",
    getComments
);

router.patch(
    "/comments/:id",
    protect,
    requireUnrestricted,
    updateComment
);

router.delete(
    "/comments/:id",
    protect,
    deleteComment
);

router.get(
    "/:id",
    getPostById
);

router.patch(
    "/:id",
    protect,
    requireUnrestricted,
    updatePost
);

router.delete(
    "/:id",
    protect,
    deletePost
);

module.exports = router;