const Profile = require("../models/Profile");


// =====================================================
// SEARCH USERS
// =====================================================

const searchUsers = async (req, res) => {

    try {

        const query = req.query.q;


        // Validate search query

        if (!query || !query.trim()) {

            return res.status(400).json({

                success: false,

                message: "Search query is required"

            });

        }


        const searchTerm = query.trim();


        // Search public profiles

        const users = await Profile.find({

            privacy: "PUBLIC",

            $or: [

                {
                    username: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                },

                {
                    displayName: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                },

                {
                    skills: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                },

                {
                    interests: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                }

            ]

        })

        .select(
            "username displayName bio avatar skills interests privacy"
        )

        .limit(20);


        return res.status(200).json({

            success: true,

            count: users.length,

            users

        });

    } catch (error) {

        console.error(
            "Search users error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};


module.exports = {
    searchUsers
};