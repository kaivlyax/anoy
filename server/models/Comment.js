const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        // User who created the comment
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },

        // Post being commented on
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true
        },

        // Comment content
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 500
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


// Helpful for fetching comments of a post
commentSchema.index({
    post: 1,
    createdAt: -1
});


const Comment = mongoose.model(
    "Comment",
    commentSchema
);


module.exports = Comment;