const express = require("express");

const router = express.Router();

const {
    register,
    verifyEmail,
    resendOTP,
    login,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;