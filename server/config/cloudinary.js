const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Configure Cloudinary if credentials exist in environment
if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}

// Local uploads directory fallback
const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types (images + videos)
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
];

// Memory storage for buffer processing
const storage = multer.memoryStorage();

// Multer upload middleware with 25MB limit
const upload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25 MB
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Invalid file type. Only JPG, PNG, WEBP, GIF images and MP4, WEBM videos are allowed."
                )
            );
        }
    }
});

/**
 * Upload a media buffer to Cloudinary or fallback local disk.
 * @param {Buffer} buffer
 * @param {string} originalname
 * @param {string} mimetype
 * @returns {Promise<{url: string, publicId: string, format: string, size: number, width?: number, height?: number, resourceType?: string}>}
 */
const uploadMedia = async (buffer, originalname, mimetype) => {
    const isCloudinaryConfigured = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

    const isVideo = mimetype && mimetype.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    if (isCloudinaryConfigured && process.env.NODE_ENV !== "test") {
        try {
            return await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "anoy/media",
                        resource_type: resourceType,
                        transformation: isVideo ? [] : [{ quality: "auto", fetch_format: "auto" }]
                    },
                    (error, result) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                            width: result.width,
                            height: result.height,
                            format: result.format,
                            size: result.bytes,
                            resourceType: result.resource_type || resourceType,
                            originalName: originalname
                        });
                    }
                );
                stream.end(buffer);
            });
        } catch (cloudErr) {
            if (process.env.NODE_ENV === "production") throw cloudErr;
            console.warn("Cloudinary upload failed, falling back to local disk:", cloudErr.message || cloudErr);
        }
    }

    // Local Disk Fallback
    const ext = path.extname(originalname) || `.${mimetype.split("/")[1] || "jpg"}`;
    const uniqueFilename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);

    await fs.promises.writeFile(filePath, buffer);

    const baseUrl = process.env.SERVER_URL || "http://localhost:5001";
    const fileUrl = `${baseUrl}/uploads/${uniqueFilename}`;

    return {
        url: fileUrl,
        publicId: uniqueFilename,
        width: null,
        height: null,
        format: ext.replace(".", ""),
        size: buffer.length,
        resourceType: resourceType,
        originalName: originalname
    };
};

module.exports = {
    cloudinary,
    upload,
    uploadMedia,
    UPLOADS_DIR,
    ALLOWED_MIME_TYPES
};
