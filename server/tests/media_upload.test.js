const { uploadImage } = require("../controllers/mediaController");
const cloudinary = require("../config/cloudinary");

describe("Media Upload Controller Unit Tests", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("1. uploadImage: Returns 400 when no file is attached", async () => {
        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await uploadImage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining("No media file provided")
            })
        );
    });

    test("2. uploadImage: Returns 201 with media object on successful upload", async () => {
        jest.spyOn(cloudinary, "uploadMedia").mockResolvedValue({
            url: "https://res.cloudinary.com/demo/image/upload/sample.png",
            publicId: "media_sample",
            resourceType: "IMAGE",
            width: 800,
            height: 600,
            format: "png",
            size: 10240,
            originalName: "sample.png"
        });

        const req = {
            file: {
                buffer: Buffer.from("dummy-image-data"),
                originalname: "sample.png",
                mimetype: "image/png"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await uploadImage(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: "Media uploaded successfully",
                media: expect.objectContaining({
                    url: "https://res.cloudinary.com/demo/image/upload/sample.png",
                    type: "IMAGE",
                    format: "png"
                })
            })
        );
    });

    test("3. uploadImage: Correctly formats video upload response", async () => {
        jest.spyOn(cloudinary, "uploadMedia").mockResolvedValue({
            url: "https://res.cloudinary.com/demo/video/upload/sample.mp4",
            publicId: "media_video",
            resourceType: "VIDEO",
            width: 1920,
            height: 1080,
            format: "mp4",
            size: 502400,
            originalName: "sample.mp4"
        });

        const req = {
            file: {
                buffer: Buffer.from("dummy-video-data"),
                originalname: "sample.mp4",
                mimetype: "video/mp4"
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await uploadImage(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                media: expect.objectContaining({
                    type: "VIDEO",
                    url: "https://res.cloudinary.com/demo/video/upload/sample.mp4"
                })
            })
        );
    });
});
