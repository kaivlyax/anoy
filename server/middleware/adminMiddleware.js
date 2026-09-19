/**
 * Middleware strictly requiring platform ADMIN role.
 * Rejects with 403 Forbidden for any other role (USER, MODERATOR, SUPPORT) or unauthenticated users.
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user._id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Platform Administrator privilege required."
        });
    }

    next();
};

/**
 * Flexible helper middleware for platform roles if needed.
 * @param  {...string} allowedRoles
 */
const requirePlatformRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of: ${allowedRoles.join(", ")}`
            });
        }

        next();
    };
};

module.exports = {
    requireAdmin,
    requirePlatformRole
};
