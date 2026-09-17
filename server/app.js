const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const searchRoutes = require("./routes/searchRoutes");
const profileRoutes = require("./routes/profileRoutes");
const authRoutes = require("./routes/authRoutes");
const followRoutes = require("./routes/followRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const premiumRoutes = require("./routes/premiumRoutes");
const communityRoutes = require("./routes/communityRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const meetingRoomRoutes = require("./routes/meetingRoomRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const aiRoutes = require("./routes/aiRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

const app = express();

// middleware with rawBody capture for webhook cryptographic verification
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })
);
const getAllowedOrigins = () => {
    const raw = [
        process.env.CLIENT_URL,
        process.env.CORS_ORIGIN,
        "https://anoyy.tech",
        "https://www.anoyy.tech",
        "http://localhost:5173",
        "http://localhost:3000"
    ].filter(Boolean);

    const origins = [];
    raw.forEach((item) => {
        if (typeof item === "string" && item.includes(",")) {
            item.split(",").forEach((sub) => origins.push(sub.trim()));
        } else {
            origins.push(item);
        }
    });
    return [...new Set(origins)];
};

const allowedOrigins = getAllowedOrigins();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (
                allowedOrigins.includes("*") ||
                allowedOrigins.includes(origin) ||
                process.env.NODE_ENV !== "production"
            ) {
                return callback(null, true);
            }
            return callback(null, true);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
    })
);
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);
app.use(morgan("dev"));

// Serve static uploaded files locally
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/follow", followRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/premium", premiumRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/communities", communityRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/meeting-rooms", meetingRoomRoutes);
app.use("/api/v1/study-rooms", meetingRoomRoutes);
app.use("/api/v1/settings", settingsRoutes);



app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to ANOY Backend API 🚀",
        version: "1.0.0"
    });
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global production error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production" ? "Internal Server Error" : (err.message || "Internal Server Error")
    });
});

module.exports = app;
