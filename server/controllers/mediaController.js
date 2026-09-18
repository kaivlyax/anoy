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

        const isVideo = result.resourceType === "video" || (req.file.mimetype && req.file.mimetype.startsWith("video/"));

        return res.status(201).json({
            success: true,
            message: "Media uploaded successfully",
            media: {
                type: isVideo ? "VIDEO" : "IMAGE",
                url: result.url,
                publicId: result.publicId,
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
            message: error.message || "Failed to upload image. Please try again."
        });
    }
};

module.exports = {
    uploadImage
};
