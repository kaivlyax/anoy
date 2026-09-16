const mongoose = require("mongoose");

const communityBoostSchema = new mongoose.Schema(
    {
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            required: true,
            index: true
        },

        booster: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        boostedAt: {
            type: Date,
            default: Date.now
        },

        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },

        status: {
            type: String,
            enum: ["ACTIVE", "EXPIRED", "CANCELLED"],
            default: "ACTIVE",
            index: true
        }
    },
    {
        timestamps: true
    }
);

// Ensure a user can only have one active boost per community
communityBoostSchema.index({ community: 1, booster: 1, status: 1 });

const CommunityBoost = mongoose.model("CommunityBoost", communityBoostSchema);

module.exports = CommunityBoost;
