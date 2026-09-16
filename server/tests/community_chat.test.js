require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const CommunityMessage = require("../models/CommunityMessage");

describe("Community Real-Time Chat & Moderation Suite", () => {
    let owner, mod, member, stranger;
    let ownerToken, modToken, memberToken, strangerToken;
    let privateCommunity;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        await Identity.deleteMany({
            email: { $in: ["comm_owner@test.com", "comm_mod@test.com", "comm_mem@test.com", "comm_stranger@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["comm_owner", "comm_mod", "comm_mem", "comm_stranger"] }
        });
        await Community.deleteMany({ slug: "private-study-club" });

        owner = await Identity.create({ email: "comm_owner@test.com", username: "comm_owner", passwordHash: "h", emailVerified: true, status: "ACTIVE" });
        mod = await Identity.create({ email: "comm_mod@test.com", username: "comm_mod", passwordHash: "h", emailVerified: true, status: "ACTIVE" });
        member = await Identity.create({ email: "comm_mem@test.com", username: "comm_mem", passwordHash: "h", emailVerified: true, status: "ACTIVE" });
        stranger = await Identity.create({ email: "comm_stranger@test.com", username: "comm_stranger", passwordHash: "h", emailVerified: true, status: "ACTIVE" });

        ownerToken = jwt.sign({ userId: owner._id, username: owner.username }, process.env.JWT_SECRET);
        modToken = jwt.sign({ userId: mod._id, username: mod.username }, process.env.JWT_SECRET);
        memberToken = jwt.sign({ userId: member._id, username: member.username }, process.env.JWT_SECRET);
        strangerToken = jwt.sign({ userId: stranger._id, username: stranger.username }, process.env.JWT_SECRET);

        privateCommunity = await Community.create({
            name: "Private Study Club",
            slug: "private-study-club",
            isPrivate: true,
            owner: owner._id,
            moderators: [mod._id],
            members: [owner._id, mod._id, member._id]
        });
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["comm_owner@test.com", "comm_mod@test.com", "comm_mem@test.com", "comm_stranger@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["comm_owner", "comm_mod", "comm_mem", "comm_stranger"] }
        });
        if (privateCommunity) {
            await Community.deleteMany({ _id: privateCommunity._id });
            await CommunityMessage.deleteMany({ community: privateCommunity._id });
        }
    }, 30000);

    it("Stranger cannot read private community messages (403)", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${privateCommunity._id}/messages`)
            .set("Authorization", `Bearer ${strangerToken}`);

        expect(res.statusCode).toBe(403);
    });

    it("Member can send a message to general channel", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${privateCommunity._id}/messages`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({
                channel: "general",
                content: "Hello community members!"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message.content).toBe("Hello community members!");
    });

    it("Moderator can delete inappropriate member message", async () => {
        const msgRes = await request(app)
            .post(`/api/v1/communities/${privateCommunity._id}/messages`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({
                channel: "general",
                content: "Inappropriate spam message"
            });

        const msgId = msgRes.body.message._id;

        const delRes = await request(app)
            .delete(`/api/v1/communities/${privateCommunity._id}/messages/${msgId}`)
            .set("Authorization", `Bearer ${modToken}`);

        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);
    });

    it("Stranger cannot delete member message (403)", async () => {
        const msgRes = await request(app)
            .post(`/api/v1/communities/${privateCommunity._id}/messages`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({
                channel: "general",
                content: "Valid message"
            });

        const msgId = msgRes.body.message._id;

        const delRes = await request(app)
            .delete(`/api/v1/communities/${privateCommunity._id}/messages/${msgId}`)
            .set("Authorization", `Bearer ${strangerToken}`);

        expect(delRes.statusCode).toBe(403);
    });
});
