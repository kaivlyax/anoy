const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
    {
        // User who initiated the block
        blocker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        // User who is blocked
        blocked: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate block entries
blockSchema.index(
    {
        blocker: 1,
        blocked: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Block", blockSchema);
