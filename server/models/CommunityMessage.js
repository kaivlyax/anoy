const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema(
    {
        // Community this message belongs to
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            required: true,
            index: true
        },

        // Channel within the community (e.g., 'general', 'announcements', 'study-lounge')
        channel: {
            type: String,
            default: "general",
            trim: true,
            lowercase: true,
            index: true
        },

        // Sender of the message
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        // Type of message
        messageType: {
            type: String,
            enum: ["TEXT", "IMAGE"],
            default: "TEXT"
        },

        // Content or caption
        content: {
            type: String,
            default: "",
            trim: true,
            maxlength: 2000
        },

        // Media URL for images
        mediaUrl: {
            type: String,
            default: ""
        },

        // Media metadata
        mediaMeta: {
            width: { type: Number, default: null },
            height: { type: Number, default: null },
            format: { type: String, default: "" },
            size: { type: Number, default: 0 },
            originalName: { type: String, default: "" }
        },

        // Moderation / soft deletion
        isDeleted: {
            type: Boolean,
            default: false
        },

        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: null
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

// Compound index for fast paginated channel queries
communityMessageSchema.index({ community: 1, channel: 1, createdAt: -1 });

const CommunityMessage = mongoose.model("CommunityMessage", communityMessageSchema);

module.exports = CommunityMessage;
