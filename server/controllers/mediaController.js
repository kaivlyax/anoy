const { uploadMedia } = require("../config/cloudinary");

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image file provided. Please attach an image."
            });
        }

        const result = await uploadMedia(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        return res.status(201).json({
            success: true,
            message: "Image uploaded successfully",
            media: {
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
