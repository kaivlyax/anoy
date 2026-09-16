const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        // The conversation this message belongs to
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true
        },

        // Sender of the message
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },

        // Type of message
        messageType: {
            type: String,
            enum: ["TEXT", "IMAGE"],
            default: "TEXT"
        },

        // Content / text caption of the message
        content: {
            type: String,
            default: "",
            trim: true,
            maxlength: 2000
        },

        // Media URL for image messages
        mediaUrl: {
            type: String,
            default: ""
        },

        // Media metadata (dimensions, size, format, name)
        mediaMeta: {
            width: { type: Number, default: null },
            height: { type: Number, default: null },
            format: { type: String, default: "" },
            size: { type: Number, default: 0 },
            originalName: { type: String, default: "" }
        },

        // Read status
        read: {
            type: Boolean,
            default: false,
            index: true
        },

        // Timestamp when message was marked as read
        readAt: {
            type: Date,
            default: null
        },

        // Soft deletion flag
        isDeleted: {
            type: Boolean,
            default: false
        },

        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Compound index for fast paginated retrieval of conversation messages
messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
