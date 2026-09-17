const mongoose = require("mongoose");

const moderationLogSchema = new mongoose.Schema(
    {
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            required: true,
            index: true
        },

        moderator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: null
        },

        action: {
            type: String,
            required: true,
            enum: [
                "PROMOTE_MODERATOR",
                "DEMOTE_MODERATOR",
                "REMOVE_MEMBER",
                "BAN_MEMBER",
                "UNBAN_MEMBER",
                "DELETE_MESSAGE",
                "RESOLVE_REPORT",
                "DISMISS_REPORT",
                "DELETE_MEETING_ROOM",
                "UPDATE_SETTINGS"
            ]
        },

        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
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

moderationLogSchema.index({ community: 1, createdAt: -1 });

const ModerationLog = mongoose.models.ModerationLog || mongoose.model("ModerationLog", moderationLogSchema);

module.exports = ModerationLog;
