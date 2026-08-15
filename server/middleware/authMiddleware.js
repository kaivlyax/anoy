const jwt = require("jsonwebtoken");
const Identity = require("../models/Identity");


const protect = async (req, res, next) => {

    try {

        // =========================
        // Get Authorization header
        // =========================

        const authHeader = req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });

        }


        // =========================
        // Check Bearer format
        // =========================

        if (!authHeader.startsWith("Bearer ")) {

            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });

        }


        // =========================
        // Extract token
        // =========================

        const token =
            authHeader.split(" ")[1];


        if (!token) {

            return res.status(401).json({
                success: false,
                message: "Authentication token missing"
            });

        }


        // =========================
        // Verify JWT
        // =========================

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        // =========================
        // Find user
        // =========================

        const user = await Identity.findById(
            decoded.userId
        );


        if (!user) {

            return res.status(401).json({
                success: false,
                message: "User no longer exists"
            });

        }


        // =========================
        // Check account status
        // =========================

        if (user.status === "BANNED") {

            return res.status(403).json({
                success: false,
                message: "Your account has been banned"
            });

        }


        if (user.status === "DELETED") {

            return res.status(403).json({
                success: false,
                message: "Your account has been deleted"
            });

        }


        // =========================
        // Attach user to request
        // =========================

        req.user = user;

        next();


    } catch (error) {

        console.error(
            "Authentication middleware error:",
            error.message
        );


        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });

    }

};


module.exports = protect;