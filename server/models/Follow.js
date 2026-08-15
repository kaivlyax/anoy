const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
    {

        // User who is sending the follow request
        follower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },


        // User being followed
        following: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },


        // Follow relationship status
        status: {
            type: String,
            enum: [
                "PENDING",
                "ACCEPTED",
                "REJECTED"
            ],
            default: "ACCEPTED"
        }

    },

    {
        timestamps: true
    }
);


// Prevent duplicate follow relationships

followSchema.index(
    {
        follower: 1,
        following: 1
    },
    {
        unique: true
    }
);


// Make follower/following queries fast

followSchema.index({
    following: 1
});

followSchema.index({
    follower: 1
});


const Follow = mongoose.model(
    "Follow",
    followSchema
);


module.exports = Follow;