const express = require("express");

const router = express.Router();

const {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    getFollowStatus
} = require("../controllers/followController");

const protect = require("../middleware/authMiddleware");
const { requireUnrestricted } = require("../middleware/restrictionMiddleware");

router.get(
    "/requests",
    protect,
    getFollowRequests
);

router.post(
    "/requests/:username/accept",
    protect,
    requireUnrestricted,
    acceptFollowRequest
);

router.post(
    "/requests/:username/reject",
    protect,
    requireUnrestricted,
    rejectFollowRequest
);

router.get(
    "/:username/status",
    protect,
    getFollowStatus
);

router.post(
    "/:username",
    protect,
    requireUnrestricted,
    followUser
);

router.delete(
    "/:username",
    protect,
    requireUnrestricted,
    unfollowUser
);


router.get(
    "/:username/followers",
    getFollowers
);

router.get(
    "/:username/following",
    getFollowing
);


module.exports = router;