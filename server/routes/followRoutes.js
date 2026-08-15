const express = require("express");

const router = express.Router();

const {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest
} = require("../controllers/followController");

const protect = require("../middleware/authMiddleware");


// =====================================================
// FOLLOW REQUESTS
// =====================================================

router.get(
    "/requests",
    protect,
    getFollowRequests
);


router.post(
    "/requests/:username/accept",
    protect,
    acceptFollowRequest
);


router.post(
    "/requests/:username/reject",
    protect,
    rejectFollowRequest
);


// =====================================================
// FOLLOW / UNFOLLOW
// =====================================================

router.post(
    "/:username",
    protect,
    followUser
);


router.delete(
    "/:username",
    protect,
    unfollowUser
);


// =====================================================
// FOLLOWERS / FOLLOWING
// =====================================================

router.get(
    "/:username/followers",
    getFollowers
);


router.get(
    "/:username/following",
    getFollowing
);


module.exports = router;