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
        },

        // Premium / Pro System
        isPro: {
            type: Boolean,
            default: false,
            index: true
        },

        proPlan: {
            type: String,
            enum: [
                "FREE",
                "PRO_MONTHLY",
                "PRO_ANNUAL",
                "PRO_LIFETIME"
            ],
            default: "FREE"
        },

        proExpiresAt: {
            type: Date,
            default: null
        },

        // Active Customizations
        avatarDecoration: {
            type: String,
            default: ""
        },

        profileDecoration: {
            type: String,
            default: ""
        },

        profileTheme: {
            type: String,
            default: "default"
        },

        // Unlocked Items & Packs
        unlockedDecorations: {
            type: [String],
            default: []
        },

        unlockedEmojiPacks: {
            type: [String],
            default: ["default"]
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