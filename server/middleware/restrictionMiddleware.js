/**
 * Middleware and utility helpers for Granular Platform Interaction Restrictions.
 * Allows restricted users to browse/read ANOY while prohibiting write actions (posts, comments, likes, messages, etc.).
 */

/**
 * Evaluates whether an Identity document has an active restriction.
 * Automatically treats expired temporary restrictions as unrestricted.
 *
 * @param {Object} user - Identity document or user object
 * @returns {Object} Restriction evaluation state
 */
const isUserRestricted = (user) => {
    if (!user || !user.restriction || !user.restriction.isRestricted) {
        return {
            restricted: false,
            isRestricted: false,
            reason: null,
            expiresAt: null,
            restrictedAt: null,
            restrictedBy: null
        };
    }

    // Check if temporary restriction has passed its expiration timestamp
    if (user.restriction.expiresAt) {
        const expiresAtDate = new Date(user.restriction.expiresAt);
        if (expiresAtDate <= new Date()) {
            return {
                restricted: false,
                isRestricted: false,
                reason: null,
                expiresAt: null,
                restrictedAt: null,
                restrictedBy: null,
                expired: true,
                expiredAt: expiresAtDate
            };
        }
    }

    return {
        restricted: true,
        isRestricted: true,
        reason: user.restriction.reason || "Account interaction restricted by administrator",
        restrictedAt: user.restriction.restrictedAt || null,
        expiresAt: user.restriction.expiresAt || null,
        restrictedBy: user.restriction.restrictedBy || null,
        isPermanent: !user.restriction.expiresAt
    };
};

/**
 * Express middleware to prevent interaction-restricted accounts from performing write operations.
 */
const requireUnrestricted = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const status = isUserRestricted(req.user);

        if (status.restricted) {
            const expiryStr = status.expiresAt
                ? ` until ${new Date(status.expiresAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                })}`
                : " permanently";

            return res.status(403).json({
                success: false,
                restricted: true,
                message: `Your account is currently restricted from creating content or sending messages${expiryStr}. Reason: ${status.reason}`,
                restriction: {
                    reason: status.reason,
                    expiresAt: status.expiresAt,
                    restrictedAt: status.restrictedAt,
                    isPermanent: status.isPermanent
                }
            });
        }

        next();
    } catch (err) {
        console.error("requireUnrestricted middleware error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error checking account restriction status"
        });
    }
};

module.exports = {
    isUserRestricted,
    requireUnrestricted
};
