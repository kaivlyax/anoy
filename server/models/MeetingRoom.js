const mongoose = require("mongoose");

const meetingRoomSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        title: {
            type: String,
            trim: true,
            maxlength: 100,
            default: function () {
                return this.name || "";
            }
        },

        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500
        },

        // Every Meeting Room belongs strictly to a Community
        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            required: true,
            index: true
        },

        // Host / Creator
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: function () {
                return this.createdBy;
            },
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
            default: 10,
            min: 2,
            max: 30
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

// Pre-save sync name/title and createdBy/creator
meetingRoomSchema.pre("save", function () {
    if (this.name && !this.title) this.title = this.name;
    if (this.title && !this.name) this.name = this.title;
    if (this.createdBy && !this.creator) this.creator = this.createdBy;
    if (this.creator && !this.createdBy) this.createdBy = this.creator;
});

// Indexes for fast lookup
meetingRoomSchema.index({ community: 1, isActive: 1 });

const MeetingRoom = mongoose.models.MeetingRoom || mongoose.model("MeetingRoom", meetingRoomSchema);

module.exports = MeetingRoom;
