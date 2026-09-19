const mongoose = require("mongoose");


const identitySchema = new mongoose.Schema(
    {

        email: {
            type: String,
            required: function () {
            return this.loginProvider === "email";
        },
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true
        },


        username: {
            type:String,
            unique:true,
            sparse:true,
            lowercase:true,
            trim:true
        },


        passwordHash: {
            type: String,
            required: function () {
                return this.loginProvider === "email";
            }
        },


        loginProvider: {
            type: String,
            enum: [
                "email",
                "google",
                "apple"
            ],
            default: "email"
        },


        emailVerified: {
            type: Boolean,
            default: false
        },


        status: {
            type: String,
            enum: [
                "PENDING",
                "ACTIVE",
                "BANNED",
                "DELETED"
            ],
            default: "PENDING"
        },

        role: {
            type: String,
            enum: [
                "USER",
                "MODERATOR",
                "SUPPORT",
                "ADMIN"
            ],
            default: "USER"
        },

        banReason: {
            type: String,
            default: null
        },

        bannedAt: {
            type: Date,
            default: null
        },

        bannedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Identity",
            default: null
        },

        restriction: {
            isRestricted: {
                type: Boolean,
                default: false
            },
            reason: {
                type: String,
                default: null
            },
            restrictedAt: {
                type: Date,
                default: null
            },
            expiresAt: {
                type: Date,
                default: null
            },
            restrictedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Identity",
                default: null
            }
        },


        verificationOTP: {
            type: String
        },

        verificationOTPHash: {
            type: String
        },

        verificationOTPExpiry: {
            type: Date
        },

        verificationAttempts: {
            type: Number,
            default: 0
        },

        lastOTPResentAt: {
            type: Date
        },


        passwordResetOTP: {
            type: String
        },

        passwordResetExpiry: {
            type: Date
        },

        passwordResetAttempts: {
            type: Number,
            default: 0
        },

        lastPasswordResetRequestedAt: {
            type: Date
        },


        lastLogin: {
            type: Date
        },

        tokenVersion: {
            type: Number,
            default: 0
        }

    },
    {
        timestamps: true
    }
);


const Identity = mongoose.model(
    "Identity",
    identitySchema
);


module.exports = Identity;