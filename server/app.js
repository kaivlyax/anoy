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
const settingsRoutes = require("./routes/settingsRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

// middleware with rawBody capture for webhook cryptographic verification
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })
);
app.use(cors());
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
app.use("/api/v1/communities", communityRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/meeting-rooms", meetingRoomRoutes);
app.use("/api/v1/study-rooms", meetingRoomRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/ai", aiRoutes);


app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to ANOY Backend API 🚀",
        version: "1.0.0"
    });
});

module.exports = app;
