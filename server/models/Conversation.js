const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
    {
        // Exactly two participants for 1-to-1 conversation
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Identity",
                required: true
            }
        ],

        // Reference to the most recent message in this conversation
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null
        },

        // Timestamp of the latest message for ordering
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

// Compound index for quickly finding a conversation between participants and sorting by recent activity
conversationSchema.index({ participants: 1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;
