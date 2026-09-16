const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        plan: {
            type: String,
            enum: ["PRO_MONTHLY", "PRO_ANNUAL", "PRO_LIFETIME"],
            required: true
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        razorpayPaymentId: {
            type: String,
            default: null,
            sparse: true,
            index: true
        },

        razorpaySignature: {
            type: String,
            default: null
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            default: "INR"
        },

        status: {
            type: String,
            enum: ["created", "paid", "failed", "refunded"],
            default: "created",
            index: true
        },

        paidAt: {
            type: Date,
            default: null
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

// Compound index for fast lookup of a user's payments
paymentSchema.index({ user: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
