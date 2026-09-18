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


const protect =
    require("../middleware/authMiddleware");


// CREATE POST
router.post(
    "/",
    protect,
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
    likePost
);


router.delete(
    "/:postId/like",
    protect,
    unlikePost
);

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

router.get(
    "/:id",
    getPostById
);


router.patch(
    "/:id",
    protect,
    updatePost
);


router.delete(
    "/:id",
    protect,
    deletePost
);


module.exports = router;