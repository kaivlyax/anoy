const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
    {
        // User who liked the post
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },

        // Post that was liked
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true
        }
    },
    {
        timestamps: true
    }
);


// =====================================================
// PREVENT DUPLICATE LIKES
// =====================================================

likeSchema.index(
    {
        user: 1,
        post: 1
    },
    {
        unique: true
    }
);


const Like = mongoose.model(
    "Like",
    likeSchema
);


module.exports = Like;