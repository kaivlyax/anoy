const Identity = require("../models/Identity");
const bcrypt = require("bcryptjs");
const validator = require("validator");

const generateOTP = require("../utils/generateOTP");
// const sendEmail = require("../services/emailService");


const register = async (req, res) => {

    try {

        const {
            email,
            username,
            password
        } = req.body;


        // =========================
        // Validate required fields
        // =========================

        if (!email || !username || !password) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }


        // =========================
        // Validate email
        // =========================

        if (!validator.isEmail(email)) {

            return res.status(400).json({
                success: false,
                message: "Invalid email address"
            });

        }


        // =========================
        // Validate password
        // =========================

        if (password.length < 8) {

            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });

        }


        // =========================
        // Check existing account
        // =========================

        const existingUser = await Identity.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });


        if (existingUser) {

            return res.status(400).json({
                success: false,
                message: "Email or username already exists"
            });

        }


        // =========================
        // Hash password
        // =========================

        const passwordHash =
            await bcrypt.hash(password, 10);


        // =========================
        // Generate OTP
        // =========================

        const otp = generateOTP();


        // =========================
        // Create Identity
        // =========================

        const user = await Identity.create({

            email: email.toLowerCase(),

            username: username.toLowerCase(),

            passwordHash,

            loginProvider: "email",

            emailVerified: false,

            status: "PENDING",

            verificationOTP: otp,

            verificationOTPExpiry:
                new Date(Date.now() + 10 * 60 * 1000)

        });


        // =========================
        // Temporary OTP output
        // =========================

        console.log(
            `Verification OTP for ${user.email}: ${otp}`
        );


        // We will enable email sending
        // after the registration API works.


        return res.status(201).json({

            success: true,

            message:
                "Account created. Please verify your email.",

            userId: user._id

        });


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

const verifyEmail = async (req, res) => {

    try {

        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const user = await Identity.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        if (!user.verificationOTP ||
            !user.verificationOTPExpiry) {

            return res.status(400).json({
                success: false,
                message: "No verification OTP found"
            });
        }

        if (new Date() > user.verificationOTPExpiry) {

            return res.status(400).json({
                success: false,
                message: "OTP has expired"
            });
        }

        if (user.verificationOTP !== otp) {

            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        user.emailVerified = true;
        user.status = "ACTIVE";

        user.verificationOTP = undefined;
        user.verificationOTPExpiry = undefined;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Email verified successfully"
        });

    } catch (error) {

        console.error("Email verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const jwt = require("jsonwebtoken");


const login = async (req, res) => {

    try {

        const {
            identifier,
            password
        } = req.body;


        // =========================
        // Validate input
        // =========================

        if (!identifier || !password) {

            return res.status(400).json({
                success: false,
                message: "Username/email and password are required"
            });

        }


        // =========================
        // Find user
        // =========================

        const normalizedIdentifier =
            identifier.toLowerCase().trim();


        const user = await Identity.findOne({

            $or: [
                { email: normalizedIdentifier },
                { username: normalizedIdentifier }
            ]

        });


        if (!user) {

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });

        }


        // =========================
        // Check account status
        // =========================

        if (user.status === "BANNED") {

            return res.status(403).json({
                success: false,
                message: "This account has been banned"
            });

        }


        if (user.status === "DELETED") {

            return res.status(403).json({
                success: false,
                message: "This account has been deleted"
            });

        }


        // =========================
        // Check email verification
        // =========================

        if (!user.emailVerified) {

            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in"
            });

        }


        // =========================
        // Check password
        // =========================

        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.passwordHash
            );


        if (!passwordCorrect) {

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });

        }


        // =========================
        // Update last login
        // =========================

        user.lastLogin = new Date();

        await user.save();


        // =========================
        // Generate JWT
        // =========================

        const token = jwt.sign(

            {
                userId: user._id.toString(),
                username: user.username
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );


        // =========================
        // Response
        // =========================

        return res.status(200).json({

            success: true,

            message: "Login successful",

            token,

            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).json({

            success: false,
            message: "Server error"

        });

    }

};


module.exports = {
    register,
    verifyEmail,
    login
};