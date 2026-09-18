require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const MeetingRoom = require("../models/MeetingRoom");

describe("Meeting Room Participant Limits (Free: 5 vs Pro: 15) & Ban Enforcement Suite", () => {
    jest.setTimeout(30000);
    let proHostUser, freeHostUser, participantUser1, participantUser2, participantUser3, participantUser4, participantUser5, extraParticipant, bannedParticipant;
    let proHostToken, freeHostToken, participantToken1, participantToken2, participantToken3, participantToken4, participantToken5, extraToken, bannedToken;
    let community;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "test_jwt_secret_mroom_limits_2026_secure";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        const usernames = ["mr_pro_host", "mr_free_host", "mr_p1", "mr_p2", "mr_p3", "mr_p4", "mr_p5", "mr_pextra", "mr_pbanned"];
        await Identity.deleteMany({ username: { $in: usernames } });
        await Profile.deleteMany({ username: { $in: usernames } });
        await Community.deleteMany({ slug: "capacity-testing-lab" });
        await MeetingRoom.deleteMany({ name: { $in: ["Free Host Study Lounge", "Pro Host Mega Seminar"] } });

        const createTestUser = async (username, isPro = false) => {
            const ident = await Identity.create({
                email: `${username}@test.com`,
                username,
                passwordHash: "h",
                emailVerified: true,
                status: "ACTIVE"
            });
            await Profile.create({ userId: ident._id, username, displayName: username, isPro });
            const token = jwt.sign({ userId: ident._id, username }, process.env.JWT_SECRET);
            return { ident, token };
        };

        const proHost = await createTestUser("mr_pro_host", true);
        proHostUser = proHost.ident;
        proHostToken = proHost.token;

        const freeHost = await createTestUser("mr_free_host", false);
        freeHostUser = freeHost.ident;
        freeHostToken = freeHost.token;

        const p1 = await createTestUser("mr_p1");
        participantUser1 = p1.ident;
        participantToken1 = p1.token;

        const p2 = await createTestUser("mr_p2");
        participantUser2 = p2.ident;
        participantToken2 = p2.token;

        const p3 = await createTestUser("mr_p3");
        participantUser3 = p3.ident;
        participantToken3 = p3.token;

        const p4 = await createTestUser("mr_p4");
        participantUser4 = p4.ident;
        participantToken4 = p4.token;

        const p5 = await createTestUser("mr_p5");
        participantUser5 = p5.ident;
        participantToken5 = p5.token;

        const pExtra = await createTestUser("mr_pextra");
        extraParticipant = pExtra.ident;
        extraToken = pExtra.token;

        const pBanned = await createTestUser("mr_pbanned");
        bannedParticipant = pBanned.ident;
        bannedToken = pBanned.token;

        community = await Community.create({
            name: "Capacity Testing Lab",
            slug: "capacity-testing-lab",
            description: "Room capacity limit tests",
            owner: proHostUser._id,
            members: [proHostUser._id, freeHostUser._id, participantUser1._id, participantUser2._id, participantUser3._id, participantUser4._id, participantUser5._id, extraParticipant._id],
            bannedUsers: [{
                user: bannedParticipant._id,
                bannedBy: proHostUser._id,
                reason: "Disruptive behavior",
                bannedAt: new Date()
            }],
            isPrivate: false
        });
    }, 30000);

    afterAll(async () => {
        const usernames = ["mr_pro_host", "mr_free_host", "mr_p1", "mr_p2", "mr_p3", "mr_p4", "mr_p5", "mr_pextra", "mr_pbanned"];
        await Identity.deleteMany({ username: { $in: usernames } });
        await Profile.deleteMany({ username: { $in: usernames } });
        await Community.deleteMany({ slug: "capacity-testing-lab" });
        await MeetingRoom.deleteMany({ name: { $in: ["Free Host Study Lounge", "Pro Host Mega Seminar"] } });
    }, 30000);

    it("Free tier host: Requested capacity > 5 is strictly capped to 5", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${community._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${freeHostToken}`)
            .send({
                name: "Free Host Study Lounge",
                description: "Studying maths",
                maxParticipants: 15 // Attempting to request 15 on a free account
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.meetingRoom.maxParticipants).toBe(5);
        expect(res.body.meetingRoom.isHostPro).toBe(false);
        expect(res.body.meetingRoom.hostTierLimit).toBe(5);
    });

    it("ANOY Pro host: Requested capacity up to 15 is granted", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${community._id}/meeting-rooms`)
            .set("Authorization", `Bearer ${proHostToken}`)
            .send({
                name: "Pro Host Mega Seminar",
                description: "Pro workshop session",
                maxParticipants: 15
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.meetingRoom.maxParticipants).toBe(15);
        expect(res.body.meetingRoom.isHostPro).toBe(true);
        expect(res.body.meetingRoom.hostTierLimit).toBe(15);
    });

    it("Room capacity enforcement: Blocks joining when 5 free limit is filled", async () => {
        const freeRoom = await MeetingRoom.findOne({ name: "Free Host Study Lounge" });
        expect(freeRoom).not.toBeNull();

        // Simulate 5 active participants already in the room
        freeRoom.activeParticipants = [
            { user: freeHostUser._id, socketId: "s0", joinedAt: new Date() },
            { user: participantUser1._id, socketId: "s1", joinedAt: new Date() },
            { user: participantUser2._id, socketId: "s2", joinedAt: new Date() },
            { user: participantUser3._id, socketId: "s3", joinedAt: new Date() },
            { user: participantUser4._id, socketId: "s4", joinedAt: new Date() }
        ];
        await freeRoom.save();

        // 6th participant tries to join REST endpoint
        const res = await request(app)
            .post(`/api/v1/meeting-rooms/${freeRoom._id}/join`)
            .set("Authorization", `Bearer ${extraToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/full/i);
    });

    it("Banned user is blocked from joining meeting room", async () => {
        const proRoom = await MeetingRoom.findOne({ name: "Pro Host Mega Seminar" });
        expect(proRoom).not.toBeNull();

        const res = await request(app)
            .post(`/api/v1/meeting-rooms/${proRoom._id}/join`)
            .set("Authorization", `Bearer ${bannedToken}`)
            .send({});

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/banned/i);
    });
});
