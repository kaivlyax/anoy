/**
 * In-memory sliding window rate limiter for ANOY AI.
 * Limits users to 10 AI requests per 60-second window.
 * Automatically evicts expired entries to keep memory footprint minimal.
 */
const userRequestWindows = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;
const MAX_ENTRIES = 5000;

// Periodic cleanup of stale entries (unref'd to prevent Jest/Node process hang)
const cleanupStaleEntries = () => {
    const now = Date.now();
    for (const [userId, timestamps] of userRequestWindows.entries()) {
        const valid = timestamps.filter((t) => now - t < WINDOW_MS);
        if (valid.length === 0) {
            userRequestWindows.delete(userId);
        } else {
            userRequestWindows.set(userId, valid);
        }
    }
};

const cleanupTimer = setInterval(cleanupStaleEntries, 2 * 60 * 1000);
if (cleanupTimer.unref) {
    cleanupTimer.unref();
}

const aiRateLimiter = (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip || "unknown";
    const now = Date.now();

    // Guard against memory leaks if map size spikes
    if (userRequestWindows.size > MAX_ENTRIES) {
        cleanupStaleEntries();
    }

    const timestamps = userRequestWindows.get(userId) || [];
    const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

    if (validTimestamps.length >= MAX_REQUESTS) {
        const retryAfterSec = Math.max(1, Math.ceil((validTimestamps[0] + WINDOW_MS - now) / 1000));
        return res.status(429).json({
            success: false,
            message: `Too many AI requests. Please wait ${retryAfterSec} seconds before sending another message.`,
            retryAfter: retryAfterSec
        });
    }

    validTimestamps.push(now);
    userRequestWindows.set(userId, validTimestamps);
    next();
};

module.exports = aiRateLimiter;
