require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");

const app = express();

// =======================
// Connect Database
// =======================
connectDB();

// =======================
// Global Middleware
// =======================
app.use(express.json());

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

// =======================
// Health Check Route
// =======================
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to ANOY Backend API 🚀",
        version: "1.0.0"
    });
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});