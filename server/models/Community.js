const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },

        description: {
            type: String,
            maxlength: 500,
            default: ""
        },

        avatar: {
            type: String,
            default: ""
        },

        coverImage: {
            type: String,
            default: ""
        },

        isPrivate: {
            type: Boolean,
            default: false
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        moderators: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Identity"
            }
        ],

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Identity"
            }
        ],

        boostCount: {
            type: Number,
            default: 0
        },

        boostLevel: {
            type: Number,
            default: 0 // 0: 0 boosts, 1: 2+ boosts, 2: 5+ boosts, 3: 10+ boosts
        },

        isBoosted: {
            type: Boolean,
            default: false,
            index: true
        },

        activeDecorations: {
            iconFrame: {
                type: String,
                default: ""
            },
            bannerTheme: {
                type: String,
                default: ""
            },
            chatBackground: {
                type: String,
                default: ""
            },
            theme: {
                type: String,
                default: "default"
            }
        },

        unlockedDecorations: {
            type: [String],
            default: []
        },

        settings: {
            allowMemberPosts: {
                type: Boolean,
                default: true
            },
            requireApproval: {
                type: Boolean,
                default: false
            }
        }
    },
    {
        timestamps: true
    }
);

// Helper method to compute boost level
communitySchema.methods.updateBoostLevel = function () {
    const count = this.boostCount || 0;
    if (count >= 10) {
        this.boostLevel = 3;
        this.isBoosted = true;
    } else if (count >= 5) {
        this.boostLevel = 2;
        this.isBoosted = true;
    } else if (count >= 2) {
        this.boostLevel = 1;
        this.isBoosted = true;
    } else {
        this.boostLevel = 0;
        this.isBoosted = count > 0;
    }
};

const Community = mongoose.model("Community", communitySchema);

module.exports = Community;
