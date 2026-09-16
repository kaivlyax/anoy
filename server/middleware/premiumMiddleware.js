const Profile = require("../models/Profile");

/**
 * Validates if the given profile object has an active Pro subscription.
 * @param {object} profile
 * @returns {boolean}
 */
const isProfilePro = (profile) => {
    if (!profile || !profile.isPro) return false;
    if (!profile.proExpiresAt) return true; // Lifetime
    return new Date(profile.proExpiresAt) > new Date();
};

/**
 * Strict Authorization Middleware: Requires the authenticated user to be an active Pro subscriber.
 * Rejects with 403 Forbidden if not Pro or if Pro subscription has expired.
 */
const requirePro = async (req, res, next) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile || !isProfilePro(profile)) {
            return res.status(403).json({
                success: false,
                message: "This feature requires an active ANOY Pro subscription",
                requiresPro: true
            });
        }

        req.userProfile = profile;
        req.isPro = true;
        next();
    } catch (error) {
        console.error("requirePro middleware error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error verifying Pro status"
        });
    }
};

/**
 * Optional / Permissive Middleware: Attaches req.isPro and req.userProfile without blocking non-Pro users.
 */
const checkIsPro = async (req, res, next) => {
    try {
        if (req.user && req.user._id) {
            const profile = await Profile.findOne({ userId: req.user._id });
            req.userProfile = profile;
            req.isPro = isProfilePro(profile);
        } else {
            req.isPro = false;
        }
        next();
    } catch (error) {
        req.isPro = false;
        next();
    }
};

/**
 * Returns upload limits based on user's Pro status.
 */
const getUploadLimits = (isPro) => {
    const STANDARD_LIMIT_BYTES = parseInt(process.env.STANDARD_UPLOAD_LIMIT, 10) || 5 * 1024 * 1024; // 5MB
    const PRO_LIMIT_BYTES = parseInt(process.env.PRO_UPLOAD_LIMIT, 10) || 25 * 1024 * 1024; // 25MB

    return {
        maxBytes: isPro ? PRO_LIMIT_BYTES : STANDARD_LIMIT_BYTES,
        maxLabel: isPro ? "25MB (HD)" : "5MB",
        isProBonus: Boolean(isPro)
    };
};

module.exports = {
    isProfilePro,
    requirePro,
    checkIsPro,
    getUploadLimits
};
