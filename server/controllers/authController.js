const Identity = require("../models/Identity");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const generateOTP = require("../utils/generateOTP");
const { hashOTP, compareOTP } = require("../utils/hashUtils");
const { sendVerificationEmail } = require("../services/emailService");

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Register a new user account and dispatch real email OTP.
 */
const register = async (req, res) => {
    try {
        const { email, username, password } = req.body;

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
        // Validate email format
        // =========================
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address"
            });
        }

        // =========================
        // Validate password length
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
                { email: email.toLowerCase().trim() },
                { username: username.toLowerCase().trim() }
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
        const passwordHash = await bcrypt.hash(password, 10);

        // =========================
        // Generate & Hash secure OTP
        // =========================
        const otp = generateOTP();
        const otpHashed = hashOTP(otp);

        // =========================
        // Create Identity record
        // =========================
        const user = await Identity.create({
            email: email.toLowerCase().trim(),
            username: username.toLowerCase().trim(),
            passwordHash,
            loginProvider: "email",
            emailVerified: false,
            status: "PENDING",
            verificationOTPHash: otpHashed,
            verificationOTPExpiry: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
            verificationAttempts: 0,
            lastOTPResentAt: new Date()
        });

        // =========================
        // Send verification email
        // =========================
        try {
            await sendVerificationEmail(user.email, otp, user.username);
        } catch (emailErr) {
            console.error("[register] Email delivery failed:", emailErr.message);
            // We continue so account exists, user can use resend OTP
        }

        return res.status(201).json({
            success: true,
            message: "Account created. A verification code has been sent to your email.",
            userId: user._id
        });

    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

/**
 * Verify 6-digit email OTP.
 */
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await Identity.findOne({ email: normalizedEmail });

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

        const storedHash = user.verificationOTPHash;
        const expiry = user.verificationOTPExpiry;

        if (!storedHash || !expiry) {
            return res.status(400).json({
                success: false,
                message: "No pending verification code found. Please request a new code."
            });
        }

        // Check expiration
        if (new Date() > new Date(expiry)) {
            return res.status(400).json({
                success: false,
                message: "Verification code has expired. Please request a new code."
            });
        }

        // Check if maximum attempts already exceeded
        if ((user.verificationAttempts || 0) >= MAX_VERIFY_ATTEMPTS) {
            user.verificationOTPHash = undefined;
            user.verificationOTPExpiry = undefined;
            user.verificationAttempts = 0;
            await user.save();

            return res.status(429).json({
                success: false,
                message: "Maximum verification attempts exceeded. Please request a new code."
            });
        }

        // Compare OTP
        const isMatch = compareOTP(otp.toString().trim(), storedHash);

        if (!isMatch) {
            user.verificationAttempts = (user.verificationAttempts || 0) + 1;

            if (user.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
                user.verificationOTPHash = undefined;
                user.verificationOTPExpiry = undefined;
                await user.save();

                return res.status(429).json({
                    success: false,
                    message: "Maximum verification attempts exceeded. Please request a new code."
                });
            }

            await user.save();
            const remaining = MAX_VERIFY_ATTEMPTS - user.verificationAttempts;
            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            });
        }

        // Mark verified & activate
        user.emailVerified = true;
        user.status = "ACTIVE";
        user.verificationOTPHash = undefined;
        user.verificationOTP = undefined;
        user.verificationOTPExpiry = undefined;
        user.verificationAttempts = 0;

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

/**
 * Resend a fresh 6-digit OTP with cooldown rate-limiting.
 */
const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await Identity.findOne({ email: normalizedEmail });

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

        // Check resend cooldown
        const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;
        if (user.lastOTPResentAt) {
            const timeSinceLastResend = Date.now() - new Date(user.lastOTPResentAt).getTime();
            if (timeSinceLastResend < cooldownMs) {
                const remainingSec = Math.ceil((cooldownMs - timeSinceLastResend) / 1000);
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${remainingSec} second${remainingSec === 1 ? "" : "s"} before requesting another code.`,
                    retryAfter: remainingSec
                });
            }
        }

        // Generate new secure OTP
        const otp = generateOTP();
        const otpHashed = hashOTP(otp);

        user.verificationOTPHash = otpHashed;
        user.verificationOTPExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        user.verificationAttempts = 0;
        user.lastOTPResentAt = new Date();

        await user.save();

        // Send email
        try {
            await sendVerificationEmail(user.email, otp, user.username);
        } catch (emailErr) {
            console.error("[resendOTP] Email delivery failed:", emailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "A new verification code has been sent to your email."
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

/**
 * User login.
 */
const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Username/email and password are required"
            });
        }

        const normalizedIdentifier = identifier.toLowerCase().trim();

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

        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in"
            });
        }

        const passwordCorrect = await bcrypt.compare(password, user.passwordHash);

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        user.lastLogin = new Date();
        await user.save();

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
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    register,
    verifyEmail,
    resendOTP,
    login
};