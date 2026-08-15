const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
    {
        // Link profile to the authenticated Identity
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            unique: true
        },

        // Public username
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        // Personal information
        displayName: {
            type: String,
            trim: true,
            maxlength: 50,
            default: ""
        },

        bio: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },

        // Profile media
        avatar: {
            type: String,
            default: ""
        },

        coverImage: {
            type: String,
            default: ""
        },

        // Personalization
        skills: {
            type: [String],
            default: []
        },

        interests: {
            type: [String],
            default: []
        },

        // Profile privacy
        privacy: {
            type: String,
            enum: [
                "PUBLIC",
                "PRIVATE"
            ],
            default: "PUBLIC"
        }
    },
    {
        timestamps: true
    }
);


const Profile = mongoose.model(
    "Profile",
    profileSchema
);


module.exports = Profile;