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


        verificationOTP: {
            type: String
        },


        verificationOTPExpiry: {
            type: Date
        },


        passwordResetOTP: {
            type: String
        },


        passwordResetExpiry: {
            type: Date
        },


        lastLogin: {
            type: Date
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