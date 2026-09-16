const crypto = require("crypto");

/**
 * Generates a SHA-256 hash of an OTP code with an optional secret pepper.
 * @param {string} otp - The plain text 6-digit OTP code.
 * @returns {string} - Hex-encoded SHA-256 hash.
 */
const hashOTP = (otp) => {
    if (!otp) return null;
    const pepper = process.env.JWT_SECRET || "anoy_default_otp_pepper";
    return crypto
        .createHash("sha256")
        .update(`${otp}:${pepper}`)
        .digest("hex");
};

/**
 * Safely compares candidate OTP with stored hash using timing-safe comparison.
 * @param {string} candidateOtp - The user-submitted OTP code.
 * @param {string} storedHash - The hash stored in the database.
 * @returns {boolean} - True if match, false otherwise.
 */
const compareOTP = (candidateOtp, storedHash) => {
    if (!candidateOtp || !storedHash) return false;
    const candidateHash = hashOTP(candidateOtp.trim());
    if (candidateHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(
        Buffer.from(candidateHash, "utf8"),
        Buffer.from(storedHash, "utf8")
    );
};

module.exports = {
    hashOTP,
    compareOTP
};
