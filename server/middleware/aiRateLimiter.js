/**
 * In-memory sliding window rate limiter for ANOY AI.
 * Limits users to 10 AI requests per 60-second window.
 */
const userRequestWindows = new Map();

const aiRateLimiter = (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip;
    const now = Date.now();
    const WINDOW_MS = 60 * 1000; // 1 minute
    const MAX_REQUESTS = 10;

    const timestamps = userRequestWindows.get(userId) || [];
    const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

    if (validTimestamps.length >= MAX_REQUESTS) {
        const retryAfterSec = Math.ceil((validTimestamps[0] + WINDOW_MS - now) / 1000);
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
