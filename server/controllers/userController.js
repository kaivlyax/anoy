const Profile = require("../models/Profile");
const Identity = require("../models/Identity");

// =====================================================
// SEARCH USERS
// =====================================================

const searchUsers = async (req, res) => {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        // Prevent extremely broad searches
        if (query.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Search query must be at least 2 characters"
            });
        }

        // Exclude deleted accounts
        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const users = await Profile.find({
            privacy: "PUBLIC",
            userId: { $nin: deletedUserIds },
            $or: [
                { username: { $regex: query, $options: "i" } },
                { displayName: { $regex: query, $options: "i" } },
                { bio: { $regex: query, $options: "i" } },
                { skills: { $regex: query, $options: "i" } },
                { interests: { $regex: query, $options: "i" } }
            ]
        })
            .select("username displayName bio avatar skills interests isPro avatarDecoration")
            .limit(20);

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        console.error("Search users error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================================
// DISCOVER USERS
// =====================================================

const discoverUsers = async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 20, 1),
            50
        );

        // Exclude deleted accounts
        const deletedUsers = await Identity.find({ status: "DELETED" }).select("_id");
        const deletedUserIds = deletedUsers.map((u) => u._id);

        const users = await Profile.find({
            privacy: "PUBLIC",
            userId: { $nin: deletedUserIds }
        })
            .select("username displayName bio avatar skills interests isPro avatarDecoration")
            .sort({
                createdAt: -1
            })
            .limit(limit);

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        console.error("Discover users error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    searchUsers,
    discoverUsers
};