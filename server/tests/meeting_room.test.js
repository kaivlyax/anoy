require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const MeetingRoom = require("../models/MeetingRoom");
const Post = require("../models/Post");

describe("Meeting Rooms & Unified Search Inside Communities Suite", () => {
    let ownerUser, memberUser, nonMemberUser;
    let ownerToken, memberToken, nonMemberToken;
    let publicCommunity, privateCommunity;
    let publicRoomId, privateRoomId;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        await Identity.deleteMany({ email: { $in: ["mroom_owner@test.com", "mroom_member@test.com", "mroom_outsider@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["mroom_owner", "mroom_member", "mroom_outsider"] } });
        await Community.deleteMany({ slug: { $in: ["algo-hackers", "secret-research"] } });
        await MeetingRoom.deleteMany({ name: { $in: ["DSA Study Session", "Confidential Lab"] } });

        ownerUser = await Identity.create({
            email: "mroom_owner@test.com",
            username: "mroom_owner",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: ownerUser._id, username: "mroom_owner", displayName: "Room Owner", isPro: true });

        memberUser = await Identity.create({
            email: "mroom_member@test.com",
            username: "mroom_member",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: memberUser._id, username: "mroom_member", displayName: "Club Member" });

        nonMemberUser = await Identity.create({
            email: "mroom_outsider@test.com",
            username: "mroom_outsider",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: nonMemberUser._id, username: "mroom_outsider", displayName: "Campus Outsider" });

        ownerToken = jwt.sign({ userId: ownerUser._id, username: ownerUser.username }, process.env.JWT_SECRET);
        memberToken = jwt.sign({ userId: memberUser._id, username: memberUser.username }, process.env.JWT_SECRET);
        nonMemberToken = jwt.sign({ userId: nonMemberUser._id, username: nonMemberUser.username }, process.env.JWT_SECRET);

        // Create public community
        publicCommunity = await Community.create({
            name: "Algo Hackers",
            slug: "algo-hackers",
            description: "Competitive programming and algorithm study group",
            owner: ownerUser._id,
            members: [ownerUser._id, memberUser._id],
            isPrivate: false
        });

        // Create private community
        privateCommunity = await Community.create({
            name: "Secret Research",
            slug: "secret-research",
            description: "Private invite-only lab research team",
            owner: ownerUser._id,
            members: [ownerUser._id, memberUser._id],
            isPrivate: true
        });
    });

    afterAll(async () => {
        await Identity.deleteMany({ email: { $in: ["mroom_owner@test.com", "mroom_member@test.com", "mroom_outsider@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["mroom_owner", "mroom_member", "mroom_outsider"] } });
        await Community.deleteMany({ slug: { $in: ["algo-hackers", "secret-research"] } });
        await MeetingRoom.deleteMany({ name: { $in: ["DSA Study Session", "Confidential Lab"] } });
        await mongoose.connection.close();
    });

    it("POST /api/v1/communities/:id/meeting-rooms - creates a meeting room in public community", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${publicCommunity._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({
                name: "DSA Study Session",
                description: "Graphs & Dynamic Programming review",
                maxParticipants: 10,
                isPrivate: false
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.meetingRoom.name).toBe("DSA Study Session");
        publicRoomId = res.body.meetingRoom._id;
    });

    it("POST /api/v1/communities/:id/meeting-rooms - creates a passcode-protected meeting room in private community", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${privateCommunity._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({
                name: "Confidential Lab",
                description: "AI model safety research session",
                maxParticipants: 6,
                isPrivate: true,
                passcode: "safety2026"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        privateRoomId = res.body.meetingRoom._id;
    });

    it("GET /api/v1/communities/:id/meeting-rooms - non-member is FORBIDDEN from viewing private community meeting rooms", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${privateCommunity._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${nonMemberToken}`);

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it("GET /api/v1/communities/:id/meeting-rooms - verified member can view private community rooms", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${privateCommunity._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${memberToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.meetingRooms.length).toBeGreaterThanOrEqual(1);
        expect(res.body.meetingRooms[0].passcode).toBeUndefined(); // Never expose passcode
        expect(res.body.meetingRooms[0].hasPasscode).toBe(true);
    });

    it("POST /api/v1/meeting-rooms/:id/join - non-member cannot join meeting room of private community", async () => {
        const res = await request(app)
            .post(`/api/v1/meeting-rooms/${privateRoomId}/join`)
            .set("Authorization", `Bearer ${nonMemberToken}`)
            .send({ passcode: "safety2026" });

        expect(res.statusCode).toBe(403);
    });

    it("POST /api/v1/meeting-rooms/:id/join - member cannot join without correct passcode", async () => {
        const res = await request(app)
            .post(`/api/v1/meeting-rooms/${privateRoomId}/join`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({ passcode: "wrongpass" });

        expect(res.statusCode).toBe(401);
    });

    it("POST /api/v1/meeting-rooms/:id/join - member joins successfully with valid passcode", async () => {
        const res = await request(app)
            .post(`/api/v1/meeting-rooms/${privateRoomId}/join`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({ passcode: "safety2026" });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("GET /api/v1/search/communities - searches communities by query", async () => {
        const res = await request(app)
            .get("/api/v1/search/communities?q=algo")
            .set("Authorization", `Bearer ${ownerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.communities.some((c) => c.slug === "algo-hackers")).toBe(true);
    });

    it("GET /api/v1/search/users - searches users by query", async () => {
        const res = await request(app)
            .get("/api/v1/search/users?q=mroom")
            .set("Authorization", `Bearer ${ownerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    });
});
