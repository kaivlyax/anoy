require("dotenv").config();
const followRoutes = require("./routes/followRoutes");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const profileRoutes = require("./routes/profileRoutes");
const authRoutes = require("./routes/authRoutes");


const app = express();


// Database
const startServer = async () => {

    await connectDB();


    // Middleware
    app.use(express.json());

    app.use(cors());

    app.use(helmet());

    app.use(morgan("dev"));


    // Routes
    app.use(
        "/api/v1/profile",
        profileRoutes
    );

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


    // Health Check
    app.get("/", (req,res)=>{

        res.status(200).json({
            success:true,
            message:"Welcome to ANOY Backend API 🚀",
            version:"1.0.0"
        });

    });


    const PORT = process.env.PORT || 5001;


    app.listen(PORT,()=>{

        console.log(
            `🚀 ANOY Server running on port ${PORT}`
        );

    });

};


startServer();