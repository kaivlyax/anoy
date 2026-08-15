const Follow = require("../models/Follow");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");


// =====================================================
// FOLLOW USER
// =====================================================

const followUser = async (req, res) => {

    try {

        const targetUsername =
            req.params.username.toLowerCase();


        // Cannot follow yourself

        if (
            req.user.username.toLowerCase() ===
            targetUsername
        ) {

            return res.status(400).json({

                success: false,

                message: "You cannot follow yourself"

            });

        }


        // Find target user's profile

        const targetProfile =
            await Profile.findOne({
                username: targetUsername
            });


        if (!targetProfile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        const targetUserId =
            targetProfile.userId;


        // Check whether relationship already exists

        const existingFollow =
    await Follow.findOne({

        follower: req.user._id,

        following: targetUserId

    });


if (existingFollow) {

    // Already following
    if (existingFollow.status === "ACCEPTED") {

        return res.status(409).json({

            success: false,

            message: "User is already followed"

        });

    }


    // Request is already waiting
    if (existingFollow.status === "PENDING") {

        return res.status(409).json({

            success: false,

            message: "Follow request already pending"

        });

    }


    // Previous request was rejected
    // Allow the user to send a new request

    if (existingFollow.status === "REJECTED") {

        const newStatus =
            targetProfile.privacy === "PRIVATE"
                ? "PENDING"
                : "ACCEPTED";


        existingFollow.status =
            newStatus;


        await existingFollow.save();


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


        // Determine status based on privacy

        const status =
            targetProfile.privacy === "PRIVATE"
                ? "PENDING"
                : "ACCEPTED";


        const follow = await Follow.create({

            follower: req.user._id,

            following: targetUserId,

            status

        });


        return res.status(201).json({

            success: true,

            message:
                status === "PENDING"
                    ? "Follow request sent"
                    : "User followed successfully",

            status: follow.status

        });


    } catch (error) {

        console.error(
            "Follow user error:",
            error
        );


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

        const targetUsername =
            req.params.username.toLowerCase();


        const targetProfile =
            await Profile.findOne({
                username: targetUsername
            });


        if (!targetProfile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        const result =
            await Follow.findOneAndDelete({

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

        console.error(
            "Unfollow user error:",
            error
        );


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

        const username =
            req.params.username.toLowerCase();


        const profile =
            await Profile.findOne({
                username
            });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        const followers =
            await Follow.find({

                following: profile.userId,

                status: "ACCEPTED"

            })
            .populate(
                "follower",
                "email username"
            )
            .sort({
                createdAt: -1
            });


        return res.status(200).json({

            success: true,

            count: followers.length,

            followers

        });


    } catch (error) {

        console.error(
            "Get followers error:",
            error
        );


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

        const username =
            req.params.username.toLowerCase();


        const profile =
            await Profile.findOne({
                username
            });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        const following =
            await Follow.find({

                follower: profile.userId,

                status: "ACCEPTED"

            })
            .populate(
                "following",
                "email username"
            )
            .sort({
                createdAt: -1
            });


        return res.status(200).json({

            success: true,

            count: following.length,

            following

        });


    } catch (error) {

        console.error(
            "Get following error:",
            error
        );


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

        const requests = await Follow.find({
            following: req.user._id,
            status: "PENDING"
        })
        .populate(
            "follower",
            "email username"
        )
        .sort({
            createdAt: -1
        });


        return res.status(200).json({

            success: true,

            count: requests.length,

            requests

        });


    } catch (error) {

        console.error(
            "Get follow requests error:",
            error
        );


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

        const requesterUsername =
            req.params.username.toLowerCase();


        // Find the user who sent the request
        const requesterProfile =
            await Profile.findOne({
                username: requesterUsername
            });


        if (!requesterProfile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        // Find the pending request
        // IMPORTANT:
        // following must be the authenticated user

        const request =
            await Follow.findOne({

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


        // Accept the request

        request.status = "ACCEPTED";

        await request.save();


        return res.status(200).json({

            success: true,

            message: "Follow request accepted"

        });


    } catch (error) {

        console.error(
            "Accept follow request error:",
            error
        );


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

        const requesterUsername =
            req.params.username.toLowerCase();


        // Find requester
        const requesterProfile =
            await Profile.findOne({
                username: requesterUsername
            });


        if (!requesterProfile) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }


        // Find pending request belonging to
        // the authenticated user

        const request =
            await Follow.findOne({

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


        // Reject the request

        request.status = "REJECTED";

        await request.save();


        return res.status(200).json({

            success: true,

            message: "Follow request rejected"

        });


    } catch (error) {

        console.error(
            "Reject follow request error:",
            error
        );


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
    rejectFollowRequest

};