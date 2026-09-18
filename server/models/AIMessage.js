const mongoose = require("mongoose");

const aiMessageSchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AIConversation",
            required: true,
            index: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        role: {
            type: String,
            enum: ["user", "assistant", "system"],
            required: true
        },

        content: {
            type: String,
            required: true,
            maxlength: 4000
        },

        sources: {
            type: [
                {
                    type: { type: String, enum: ["user", "community", "post", "help", "guide"] },
                    title: String,
                    id: String,
                    url: String
                }
            ],
            default: []
        },

        tokensUsed: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Compound index for querying ordered messages within a conversation
aiMessageSchema.index({ conversation: 1, createdAt: 1 });

const AIMessage = mongoose.model("AIMessage", aiMessageSchema);

module.exports = AIMessage;
