const mongoose = require("mongoose");

const communityReportSchema = new mongoose.Schema(
    {
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            required: true,
            index: true
        },

        reporter: {
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

        targetMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CommunityMessage",
            default: null
        },

        targetMeetingRoom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MeetingRoom",
            default: null
        },

        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        details: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },

        status: {
            type: String,
            enum: ["PENDING", "RESOLVED", "DISMISSED"],
            default: "PENDING",
            index: true
        },

        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: null
        },

        resolvedAt: {
            type: Date,
            default: null
        },

        resolutionNotes: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

communityReportSchema.index({ community: 1, status: 1, createdAt: -1 });

const CommunityReport = mongoose.models.CommunityReport || mongoose.model("CommunityReport", communityReportSchema);

module.exports = CommunityReport;
