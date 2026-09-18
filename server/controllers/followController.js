const Follow = require("../models/Follow");
const Profile = require("../models/Profile");
const Identity = require("../models/Identity");
const Notification = require("../models/Notification");
const Block = require("../models/Block");

// =====================================================
// FOLLOW USER
// =====================================================
const followUser = async (req, res) => {
    try {
        const targetUsername = req.params.username.toLowerCase();

        // Cannot follow yourself
        if (req.user.username.toLowerCase() === targetUsername) {
            return res.status(400).json({
                success: false,
                message: "You cannot follow yourself"
            });
        }

        const targetProfile = await Profile.findOne({
            username: targetUsername
        });

        if (!targetProfile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const targetIdentity = await Identity.findById(targetProfile.userId);
        if (!targetIdentity || targetIdentity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const targetUserId = targetProfile.userId;

        // Check if either user has blocked the other
        const isBlocked = await Block.findOne({
            $or: [
                { blocker: req.user._id, blocked: targetUserId },
                { blocker: targetUserId, blocked: req.user._id }
            ]
        });

        if (isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Unable to follow this user"
            });
        }

        // Check whether relationship already exists
        const existingFollow = await Follow.findOne({
            follower: req.user._id,
            following: targetUserId
        });

        if (existingFollow) {
            if (existingFollow.status === "ACCEPTED") {
                return res.status(409).json({
                    success: false,
                    message: "User is already followed"
                });
            }

            if (existingFollow.status === "PENDING") {
                return res.status(409).json({
                    success: false,
                    message: "Follow request already pending"
                });
            }

            if (existingFollow.status === "REJECTED") {
                const newStatus = targetProfile.privacy === "PRIVATE" ? "PENDING" : "ACCEPTED";
                existingFollow.status = newStatus;
                await existingFollow.save();

                await Notification.create({
                    recipient: targetUserId,
                    sender: req.user._id,
                    type: "FOLLOW",
                    message:
                        newStatus === "PENDING"
                            ? `${req.user.username} sent you a follow request again`
                            : `${req.user.username} followed you again`
                });

                return res.status(200).json({
                    success: true,
                    message:
                        newStatus === "PENDING"
                            ? "Follow request sent again"
                            : "User followed successfully",
                    status: newStatus
                });
            }
        }

        const status = targetProfile.privacy === "PRIVATE" ? "PENDING" : "ACCEPTED";

        const follow = await Follow.create({
            follower: req.user._id,
            following: targetUserId,
            status
        });

        await Notification.create({
            recipient: targetUserId,
            sender: req.user._id,
            type: "FOLLOW",
            message:
                status === "PENDING"
                    ? `${req.user.username} sent you a follow request`
                    : `${req.user.username} followed you`
        });

        return res.status(201).json({
            success: true,
            message: status === "PENDING" ? "Follow request sent" : "User followed successfully",
            status: follow.status
        });
    } catch (error) {
        console.error("Follow user error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// UNFOLLOW USER
// =====================================================
const unfollowUser = async (req, res) => {
    try {
        const targetUsername = req.params.username.toLowerCase();

        const targetProfile = await Profile.findOne({
            username: targetUsername
        });

        if (!targetProfile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const targetIdentity = await Identity.findById(targetProfile.userId);
        if (!targetIdentity || targetIdentity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const result = await Follow.findOneAndDelete({
            follower: req.user._id,
            following: targetProfile.userId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Follow relationship not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User unfollowed successfully"
        });
    } catch (error) {
        console.error("Unfollow user error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// GET FOLLOWERS
// =====================================================
const getFollowers = async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();

        const profile = await Profile.findOne({
            username
        });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const identity = await Identity.findById(profile.userId);
        if (!identity || identity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const followers = await Follow.find({
            following: profile.userId,
            follower: { $nin: deletedUserIds },
            status: "ACCEPTED"
        })
            .populate("follower", "username")
            .sort({
                createdAt: -1
            });

        return res.status(200).json({
            success: true,
            count: followers.length,
            followers
        });
    } catch (error) {
        console.error("Get followers error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// GET FOLLOWING
// =====================================================
const getFollowing = async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();

        const profile = await Profile.findOne({
            username
        });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const identity = await Identity.findById(profile.userId);
        if (!identity || identity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const following = await Follow.find({
            follower: profile.userId,
            following: { $nin: deletedUserIds },
            status: "ACCEPTED"
        })
            .populate("following", "username")
            .sort({
                createdAt: -1
            });

        return res.status(200).json({
            success: true,
            count: following.length,
            following
        });
    } catch (error) {
        console.error("Get following error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// GET MY FOLLOW REQUESTS
// =====================================================
const getFollowRequests = async (req, res) => {
    try {
        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const requests = await Follow.find({
            following: req.user._id,
            follower: { $nin: deletedUserIds },
            status: "PENDING"
        })
            .populate("follower", "username")
            .sort({
                createdAt: -1
            });

        return res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    } catch (error) {
        console.error("Get follow requests error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// ACCEPT FOLLOW REQUEST
// =====================================================
const acceptFollowRequest = async (req, res) => {
    try {
        const requesterUsername = req.params.username.toLowerCase();

        const requesterProfile = await Profile.findOne({
            username: requesterUsername
        });

        if (!requesterProfile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const requesterIdentity = await Identity.findById(requesterProfile.userId);
        if (!requesterIdentity || requesterIdentity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const request = await Follow.findOne({
            follower: requesterProfile.userId,
            following: req.user._id,
            status: "PENDING"
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Follow request not found"
            });
        }

        request.status = "ACCEPTED";
        await request.save();

        await Notification.create({
            recipient: requesterProfile.userId,
            sender: req.user._id,
            type: "FOLLOW_ACCEPTED",
            message: `${req.user.username} accepted your follow request`
        });

        return res.status(200).json({
            success: true,
            message: "Follow request accepted"
        });
    } catch (error) {
        console.error("Accept follow request error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// REJECT FOLLOW REQUEST
// =====================================================
const rejectFollowRequest = async (req, res) => {
    try {
        const requesterUsername = req.params.username.toLowerCase();

        const requesterProfile = await Profile.findOne({
            username: requesterUsername
        });

        if (!requesterProfile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const requesterIdentity = await Identity.findById(requesterProfile.userId);
        if (!requesterIdentity || requesterIdentity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const request = await Follow.findOne({
            follower: requesterProfile.userId,
            following: req.user._id,
            status: "PENDING"
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Follow request not found"
            });
        }

        request.status = "REJECTED";
        await request.save();

        return res.status(200).json({
            success: true,
            message: "Follow request rejected"
        });
    } catch (error) {
        console.error("Reject follow request error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// GET FOLLOW STATUS
// =====================================================
const getFollowStatus = async (req, res) => {
    try {
        const targetUsername = req.params.username.toLowerCase();

        const targetProfile = await Profile.findOne({
            username: targetUsername
        });

        if (!targetProfile) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const targetIdentity = await Identity.findById(targetProfile.userId);
        if (!targetIdentity || targetIdentity.status === "DELETED") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const follow = await Follow.findOne({
            follower: req.user._id,
            following: targetProfile.userId
        });

        if (!follow) {
            return res.status(200).json({
                success: true,
                relationship: "NOT_FOLLOWING"
            });
        }

        if (follow.status === "PENDING") {
            return res.status(200).json({
                success: true,
                relationship: "PENDING"
            });
        }

        if (follow.status === "ACCEPTED") {
            return res.status(200).json({
                success: true,
                relationship: "FOLLOWING"
            });
        }

        return res.status(200).json({
            success: true,
            relationship: "NOT_FOLLOWING"
        });
    } catch (error) {
        console.error("Get follow status error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    getFollowStatus
};