const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema(
    {
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },
        action: {
            type: String,
            enum: [
                "USER_BAN",
                "USER_UNBAN",
                "USER_RESTRICT",
                "USER_UNRESTRICT",
                "USER_STATUS_UPDATE",
                "USER_ROLE_UPDATE",
                "PRIVATE_MESSAGE_REVIEW"
            ],
            required: true,
            index: true
        },
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: null,
            index: true
        },
        targetConversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            default: null,
            index: true
        },
        targetUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Identity"
            }
        ],
        reason: {
            type: String,
            required: true,
            trim: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        ipAddress: {
            type: String,
            default: ""
        },
        userAgent: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

// Enforce immutability on audit log records
adminAuditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne"], function () {
    throw new Error("AdminAuditLog entries are immutable and cannot be modified.");
});

const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);

module.exports = AdminAuditLog;
