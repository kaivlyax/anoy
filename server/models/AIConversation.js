const mongoose = require("mongoose");

const aiConversationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        title: {
            type: String,
            trim: true,
            default: "New Chat",
            maxlength: 100
        },

        lastMessageAt: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true
    }
);

// Compound index for querying a user's recent conversations
aiConversationSchema.index({ user: 1, lastMessageAt: -1 });

const AIConversation = mongoose.model("AIConversation", aiConversationSchema);

module.exports = AIConversation;
