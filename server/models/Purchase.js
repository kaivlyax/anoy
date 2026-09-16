const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        itemId: {
            type: String,
            required: true
        },

        itemType: {
            type: String,
            enum: [
                "PLAN",
                "AVATAR_FRAME",
                "PROFILE_THEME",
                "PROFILE_DECORATION",
                "EMOJI_PACK",
                "COMMUNITY_DECORATION"
            ],
            required: true
        },

        itemName: {
            type: String,
            required: true
        },

        pricePaid: {
            type: Number,
            default: 0
        },

        paymentStatus: {
            type: String,
            enum: ["COMPLETED", "PENDING", "REFUNDED", "FAILED"],
            default: "COMPLETED"
        },

        provider: {
            type: String,
            enum: ["MOCK", "RAZORPAY", "STRIPE"],
            default: "MOCK"
        },

        transactionId: {
            type: String,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

// Compound index for checking item ownership quickly
purchaseSchema.index({ user: 1, itemId: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
