const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const searchRoutes = require("./routes/searchRoutes");
const profileRoutes = require("./routes/profileRoutes");
const authRoutes = require("./routes/authRoutes");
const followRoutes = require("./routes/followRoutes");
const notificationRoutes =require("./routes/notificationRoutes");
const userRoutes =require("./routes/userRoutes");
const postRoutes =require("./routes/postRoutes");

const app = express();

// =======================
// Global Middleware
// =======================

app.use(express.json());

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

// =======================
// API Routes
// =======================

app.use(
    "/api/v1/auth",
    authRoutes
);

app.use(
    "/api/v1/profile",
    profileRoutes
);

app.use(
    "/api/v1/follow",
    followRoutes
);

app.use(
    "/api/v1/notifications",
    notificationRoutes
);

app.use(
    "/api/v1/users",
    userRoutes
);

app.use(
    "/api/v1/posts",
    postRoutes
);

app.use("/api/v1/search", searchRoutes);



// =======================
// Health Check
// =======================

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        message:
            "Welcome to ANOY Backend API 🚀",

        version: "1.0.0"

    });

});

// =======================
// Export App
// =======================

module.exports = app;