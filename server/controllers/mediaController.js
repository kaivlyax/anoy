const cloudinaryConfig = require("../config/cloudinary");

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No media file provided. Please attach an image or video."
            });
        }

        const result = await cloudinaryConfig.uploadMedia(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        return res.status(201).json({
            success: true,
            message: "Media uploaded successfully",
            media: {
                url: result.url,
                publicId: result.publicId,
                type: result.resourceType || (req.file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE"),
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.size,
                originalName: result.originalName
            }
        });
    } catch (error) {
        console.error("Media upload error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to upload media. Please try again."
        });
    }
};

module.exports = {
    uploadImage
};
