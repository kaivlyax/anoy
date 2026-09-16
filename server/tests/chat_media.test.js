require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

describe("Chat Media & Message Deletion Test Suite", () => {
    let userA, userB;
    let tokenA, tokenB;
    let conversation;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        await Identity.deleteMany({ email: { $in: ["media_a@test.com", "media_b@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["media_a", "media_b"] } });

        userA = await Identity.create({
            email: "media_a@test.com",
            username: "media_a",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: userA._id, username: "media_a", displayName: "Media User A" });

        userB = await Identity.create({
            email: "media_b@test.com",
            username: "media_b",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: userB._id, username: "media_b", displayName: "Media User B" });

        tokenA = jwt.sign({ userId: userA._id, username: userA.username }, process.env.JWT_SECRET);
        tokenB = jwt.sign({ userId: userB._id, username: userB.username }, process.env.JWT_SECRET);

        conversation = await Conversation.create({
            participants: [userA._id, userB._id]
        });
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({ email: { $in: ["media_a@test.com", "media_b@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["media_a", "media_b"] } });
        await Conversation.deleteMany({ _id: conversation._id });
        await Message.deleteMany({ conversation: conversation._id });
    }, 30000);

    it("POST /api/v1/media/upload - should upload an image buffer successfully", async () => {
        const dummyBuffer = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;");

        const res = await request(app)
            .post("/api/v1/media/upload")
            .set("Authorization", `Bearer ${tokenA}`)
            .attach("image", dummyBuffer, "test-pic.gif");

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.media.url).toBeDefined();
    });

    it("POST /api/v1/conversations/:id/messages - should send image message", async () => {
        const res = await request(app)
            .post(`/api/v1/conversations/${conversation._id}/messages`)
            .set("Authorization", `Bearer ${tokenA}`)
            .send({
                messageType: "IMAGE",
                mediaUrl: "http://localhost:5001/uploads/test-image.png",
                content: "Here is my project diagram"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message.messageType).toBe("IMAGE");
        expect(res.body.message.mediaUrl).toBe("http://localhost:5001/uploads/test-image.png");
    });

    it("DELETE /api/v1/conversations/:id/messages/:messageId - author can delete own message", async () => {
        const createRes = await request(app)
            .post(`/api/v1/conversations/${conversation._id}/messages`)
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ content: "Message to be deleted" });

        const messageId = createRes.body.message._id;

        const delRes = await request(app)
            .delete(`/api/v1/conversations/${conversation._id}/messages/${messageId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);
    });

    it("DELETE /api/v1/conversations/:id/messages/:messageId - User B cannot delete User A's message", async () => {
        const createRes = await request(app)
            .post(`/api/v1/conversations/${conversation._id}/messages`)
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ content: "User A private message" });

        const messageId = createRes.body.message._id;

        const delRes = await request(app)
            .delete(`/api/v1/conversations/${conversation._id}/messages/${messageId}`)
            .set("Authorization", `Bearer ${tokenB}`);

        expect(delRes.statusCode).toBe(403);
    });
});
