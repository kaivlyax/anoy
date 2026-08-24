const Profile = require("../models/Profile");
const Follow = require("../models/Follow");

// =====================================================
// CREATE PROFILE
// =====================================================

const createProfile = async (req, res) => {

    try {

        // Get identity from verified JWT
        const userId = req.user._id;


        // Check whether this user already has a profile
        const existingProfile = await Profile.findOne({
            userId
        });


        if (existingProfile) {

            return res.status(409).json({
                success: false,
                message: "Profile already exists"
            });

        }


        // Get only profile fields from request
        const {
            displayName,
            bio,
            avatar,
            coverImage,
            skills,
            interests,
            privacy
        } = req.body;


        // Create profile using authenticated user's ID
        const profile = await Profile.create({

            userId,

            // Username comes from authenticated Identity
            username: req.user.username,

            displayName: displayName || "",

            bio: bio || "",

            avatar: avatar || "",

            coverImage: coverImage || "",

            skills: skills || [],

            interests: interests || [],

            privacy: privacy || "PUBLIC"

        });


        return res.status(201).json({

            success: true,

            message: "Profile created successfully",

            profile

        });


    } catch (error) {

        console.error(
            "Create profile error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};



// =====================================================
// GET MY PROFILE
// =====================================================

const getMyProfile = async (req, res) => {

    try {

        // req.user comes from JWT middleware
        const profile = await Profile.findOne({
            userId: req.user._id
        });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "Profile not found"

            });

        }


        return res.status(200).json({

            success: true,

            profile

        });


    } catch (error) {

        console.error(
            "Get my profile error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};



// =====================================================
// GET PUBLIC PROFILE
// =====================================================

const getProfile = async (req, res) => {

    try {

        const username =
            req.params.username.toLowerCase();


        const profile = await Profile.findOne({
            username
        });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "Profile not found"

            });

        }


        // Private profiles are not publicly visible
        if (profile.privacy === "PRIVATE") {

            return res.status(403).json({

                success: false,

                message: "This profile is private"

            });

        }


        return res.status(200).json({

            success: true,

            profile

        });


    } catch (error) {

        console.error(
            "Get profile error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};



// =====================================================
// UPDATE MY PROFILE
// =====================================================

const updateMyProfile = async (req, res) => {

    try {

        const profile = await Profile.findOne({
            userId: req.user._id
        });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "Profile not found"

            });

        }


        // Only update fields explicitly provided
        const {
            displayName,
            bio,
            avatar,
            coverImage,
            skills,
            interests,
            privacy
        } = req.body;


        if (displayName !== undefined) {

            profile.displayName =
                displayName;

        }


        if (bio !== undefined) {

            profile.bio =
                bio;

        }


        if (avatar !== undefined) {

            profile.avatar =
                avatar;

        }


        if (coverImage !== undefined) {

            profile.coverImage =
                coverImage;

        }


        if (skills !== undefined) {

            profile.skills =
                skills;

        }


        if (interests !== undefined) {

            profile.interests =
                interests;

        }


        if (privacy !== undefined) {

            profile.privacy =
                privacy;

        }


        await profile.save();


        return res.status(200).json({

            success: true,

            message:
                "Profile updated successfully",

            profile

        });


    } catch (error) {

        console.error(
            "Update my profile error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};



// =====================================================
// UPDATE PROFILE BY USERNAME
// =====================================================

const updateProfile = async (req, res) => {

    try {

        const username =
            req.params.username.toLowerCase();


        // Find profile
        const profile =
            await Profile.findOne({
                username
            });


        if (!profile) {

            return res.status(404).json({

                success: false,

                message: "Profile not found"

            });

        }


        // =================================================
        // AUTHORIZATION
        // =================================================

        if (
            profile.userId.toString() !==
            req.user._id.toString()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You can only edit your own profile"

            });

        }


        // =================================================
        // ALLOWED UPDATE FIELDS
        // =================================================

        const {
            displayName,
            bio,
            avatar,
            coverImage,
            skills,
            interests,
            privacy
        } = req.body;


        if (displayName !== undefined) {

            profile.displayName =
                displayName;

        }


        if (bio !== undefined) {

            profile.bio =
                bio;

        }


        if (avatar !== undefined) {

            profile.avatar =
                avatar;

        }


        if (coverImage !== undefined) {

            profile.coverImage =
                coverImage;

        }


        if (skills !== undefined) {

            profile.skills =
                skills;

        }


        if (interests !== undefined) {

            profile.interests =
                interests;

        }


        if (privacy !== undefined) {

            profile.privacy =
                privacy;

        }


        await profile.save();


        return res.status(200).json({

            success: true,

            message:
                "Profile updated successfully",

            profile

        });


    } catch (error) {

        console.error(
            "Update profile error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =====================================================
// GET PROFILE STATS
// =====================================================

const getProfileStats = async (req, res) => {

    try {

        const username =
            req.params.username.toLowerCase();


        // Check that the profile exists
        const profile = await Profile.findOne({
            username
        });


        if (!profile) {

            return res.status(404).json({
                success: false,
                message: "Profile not found"
            });

        }


        const followersCount =
            await Follow.countDocuments({
                following: profile.userId,
                status: "ACCEPTED"
            });


        const followingCount =
            await Follow.countDocuments({
                follower: profile.userId,
                status: "ACCEPTED"
            });


        return res.status(200).json({

            success: true,

            username: profile.username,

            stats: {
                followers: followersCount,
                following: followingCount
            }

        });

    } catch (error) {

        console.error(
            "Get profile stats error:",
            error
        );


        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};



// =====================================================
// EXPORT CONTROLLERS
// =====================================================

module.exports = {

    createProfile,
    getMyProfile,
    getProfile,
    updateMyProfile,
    updateProfile,
    getProfileStats

};