const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const { uploadImage } = require("../controllers/mediaController");
const protect = require("../middleware/authMiddleware");

// Custom wrapper to catch Multer errors (like file size limits) cleanly
const handleUpload = (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File size exceeds the 5MB limit."
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message || "Invalid file upload."
            });
        }
        next();
    });
};

router.post("/upload", protect, handleUpload, uploadImage);

module.exports = router;
