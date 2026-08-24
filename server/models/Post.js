const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
    {
        // User who created the post
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true,
            index: true
        },

        // Main post content
        content: {
            type: String,
            trim: true,
            maxlength: 5000,
            default: ""
        },

        // Media URLs
        media: [
            {
                url: {
                    type: String,
                    required: true
                },

                type: {
                    type: String,
                    enum: [
                        "IMAGE",
                        "VIDEO"
                    ],
                    required: true
                }
            }
        ],

        // Post visibility
        visibility: {
            type: String,
            enum: [
                "PUBLIC",
                "FOLLOWERS",
                "PRIVATE"
            ],
            default: "PUBLIC"
        },

        // Soft delete support
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);


// Prevent completely empty posts
postSchema.pre("validate", function () {

    if (
        !this.content &&
        (!this.media || this.media.length === 0)
    ) {
        throw new Error(
            "Post must contain content or media"
        );
    }

});


const Post = mongoose.model(
    "Post",
    postSchema
);


module.exports = Post;