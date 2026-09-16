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


       

        if (!authHeader.startsWith("Bearer ")) {

            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });

        }



        const token =
            authHeader.split(" ")[1];


        if (!token) {

            return res.status(401).json({
                success: false,
                message: "Authentication token missing"
            });

        }


        

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


      

        const user = await Identity.findById(
            decoded.userId
        );


        if (!user) {

            return res.status(401).json({
                success: false,
                message: "User no longer exists"
            });

        }


       

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