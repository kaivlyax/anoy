const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const { uploadImage } = require("../controllers/mediaController");
const protect = require("../middleware/authMiddleware");
const { checkIsPro } = require("../middleware/premiumMiddleware");

// Custom wrapper to catch Multer errors cleanly and support multiple field names ("image", "file", "media")
const handleUpload = (req, res, next) => {
    const uploadMiddleware = upload.any();
    uploadMiddleware(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File size exceeds the maximum allowed upload limit."
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message || "Invalid file upload."
            });
        }
        if (req.files && req.files.length > 0) {
            req.file = req.files[0];
        }
        next();
    });
};

router.post("/upload", protect, checkIsPro, handleUpload, uploadImage);

module.exports = router;
