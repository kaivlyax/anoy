const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        // User receiving the notification
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        // User who caused the notification
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },

        // Type of notification
        type: {
            type: String,
            enum: [
                "FOLLOW",
                "FOLLOW_ACCEPTED",
                "LIKE",
                "COMMENT",
                "MESSAGE",
                "SYSTEM"
            ],
            required: true
        },

        // Optional text/data related to the event
        message: {
            type: String,
            trim: true,
            default: ""
        },

        // Whether the user has seen/read it
        read: {
            type: Boolean,
            default: false,
            index: true
        },

        // Optional reference to the object that caused it
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Notification",
    notificationSchema
);