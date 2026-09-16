const mongoose = require("mongoose");

const studyRoomSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500
        },

        topic: {
            type: String,
            default: "General Study",
            trim: true,
            maxlength: 50
        },

        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        // Optional link to a community
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            default: null,
            index: true
        },

        isPrivate: {
            type: Boolean,
            default: false
        },

        passcode: {
            type: String,
            default: ""
        },

        maxParticipants: {
            type: Number,
            default: 8,
            min: 2,
            max: 20
        },

        activeParticipants: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Identity",
                    required: true
                },
                socketId: {
                    type: String,
                    default: ""
                },
                joinedAt: {
                    type: Date,
                    default: Date.now
                },
                isMuted: {
                    type: Boolean,
                    default: false
                },
                isVideoOff: {
                    type: Boolean,
                    default: false
                },
                isScreenSharing: {
                    type: Boolean,
                    default: false
                }
            }
        ],

        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

studyRoomSchema.index({ isActive: 1, createdAt: -1 });

const StudyRoom = mongoose.model("StudyRoom", studyRoomSchema);

module.exports = StudyRoom;
