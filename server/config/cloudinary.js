const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");


/**
 * Resolve Cloudinary configuration from environment variables safely.
 * Supports both CLOUDINARY_URL and individual credentials (with whitespace/quote sanitization).
 */
const getCloudinaryConfig = () => {
    const rawUrl = (process.env.CLOUDINARY_URL || "").trim().replace(/^["']|["']$/g, "");
    if (rawUrl) {
        return { isConfigured: true, useUrl: true, url: rawUrl };
    }

    const cloud_name = (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || "").trim().replace(/^["']|["']$/g, "");
    const api_key = (process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY || "").trim().replace(/^["']|["']$/g, "");
    const api_secret = (process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET || "").trim().replace(/^["']|["']$/g, "");

    if (cloud_name && api_key && api_secret) {
        return { isConfigured: true, useUrl: false, cloud_name, api_key, api_secret };
    }

    return { isConfigured: false };
};

/**
 * Configure Cloudinary instance with current environment variables.
 */
const configureCloudinary = () => {
    const config = getCloudinaryConfig();
    if (!config.isConfigured) return false;

    try {
        if (config.useUrl) {
            cloudinary.config({
                cloudinary_url: config.url,
                secure: true
            });
        } else {
            cloudinary.config({
                cloud_name: config.cloud_name,
                api_key: config.api_key,
                api_secret: config.api_secret,
                secure: true
            });
        }
        return true;
    } catch (err) {
        console.error("[Cloudinary] Configuration error:", err.message || err);
        return false;
    }
};

// Initial configuration attempt on module load
configureCloudinary();

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
    const isConfigured = configureCloudinary();
    const isVideo = mimetype && mimetype.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    if (isConfigured && process.env.NODE_ENV !== "test") {
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
            console.error("[Cloudinary] Upload failed:", cloudErr.message || cloudErr);
            if (process.env.NODE_ENV === "production") {
                throw new Error(cloudErr.message || "Failed to upload media to storage service.");
            }
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
    configureCloudinary,
    getCloudinaryConfig,
    UPLOADS_DIR,
    ALLOWED_MIME_TYPES
};
