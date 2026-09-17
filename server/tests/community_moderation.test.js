require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const ModerationLog = require("../models/ModerationLog");
const CommunityReport = require("../models/CommunityReport");

describe("Community Moderation, Roles & Audit Logging Suite", () => {
    jest.setTimeout(30000);
    let ownerUser, modUser, memberUser, outsiderUser;
    let ownerToken, modToken, memberToken, outsiderToken;
    let testCommunity;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "test_jwt_secret_anoy_moderation_suite_2026_secure";
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy", { serverSelectionTimeoutMS: 5000 });
        }

        await Identity.deleteMany({
            email: { $in: ["cmod_owner@test.com", "cmod_mod@test.com", "cmod_member@test.com", "cmod_outsider@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["cmod_owner", "cmod_mod", "cmod_member", "cmod_outsider"] }
        });
        await Community.deleteMany({ slug: "mod-test-guild" });
        await ModerationLog.deleteMany({});
        await CommunityReport.deleteMany({});

        ownerUser = await Identity.create({
            email: "cmod_owner@test.com",
            username: "cmod_owner",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: ownerUser._id, username: "cmod_owner", displayName: "Guild Owner", isPro: true });

        modUser = await Identity.create({
            email: "cmod_mod@test.com",
            username: "cmod_mod",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: modUser._id, username: "cmod_mod", displayName: "Guild Moderator", isPro: false });

        memberUser = await Identity.create({
            email: "cmod_member@test.com",
            username: "cmod_member",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: memberUser._id, username: "cmod_member", displayName: "Active Member", isPro: false });

        outsiderUser = await Identity.create({
            email: "cmod_outsider@test.com",
            username: "cmod_outsider",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: outsiderUser._id, username: "cmod_outsider", displayName: "Campus Outsider", isPro: false });

        ownerToken = jwt.sign({ userId: ownerUser._id, username: ownerUser.username }, process.env.JWT_SECRET);
        modToken = jwt.sign({ userId: modUser._id, username: modUser.username }, process.env.JWT_SECRET);
        memberToken = jwt.sign({ userId: memberUser._id, username: memberUser.username }, process.env.JWT_SECRET);
        outsiderToken = jwt.sign({ userId: outsiderUser._id, username: outsiderUser.username }, process.env.JWT_SECRET);

        testCommunity = await Community.create({
            name: "Moderation Test Guild",
            slug: "mod-test-guild",
            description: "A community for testing moderation hierarchy",
            owner: ownerUser._id,
            moderators: [modUser._id],
            members: [ownerUser._id, modUser._id, memberUser._id],
            bannedUsers: [],
            isPrivate: false
        });
    });

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["cmod_owner@test.com", "cmod_mod@test.com", "cmod_member@test.com", "cmod_outsider@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["cmod_owner", "cmod_mod", "cmod_member", "cmod_outsider"] }
        });
        await Community.deleteMany({ slug: "mod-test-guild" });
        await ModerationLog.deleteMany({});
        await CommunityReport.deleteMany({});
        await mongoose.connection.close();
    });

    it("GET /api/v1/communities/:id/members - returns real members with roles", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${testCommunity._id}/members`)
            .set("Authorization", `Bearer ${memberToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.members.length).toBe(3);
        expect(res.body.counts.all).toBe(3);
        expect(res.body.counts.owners).toBe(1);
        expect(res.body.counts.moderators).toBe(1);
        expect(res.body.counts.members).toBe(1);

        const foundOwner = res.body.members.find(m => m.username === "cmod_owner");
        expect(foundOwner.role).toBe("OWNER");

        const foundMod = res.body.members.find(m => m.username === "cmod_mod");
        expect(foundMod.role).toBe("MODERATOR");

        const foundMember = res.body.members.find(m => m.username === "cmod_member");
        expect(foundMember.role).toBe("MEMBER");
    });

    it("POST /api/v1/communities/:id/moderators - Owner can promote member to moderator", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/moderators`)
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ targetUserId: memberUser._id });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await Community.findById(testCommunity._id);
        expect(updated.moderators.map(id => id.toString())).toContain(memberUser._id.toString());

        const log = await ModerationLog.findOne({
            community: testCommunity._id,
            action: "PROMOTE_MODERATOR",
            targetUser: memberUser._id
        });
        expect(log).not.toBeNull();
        expect(log.moderator.toString()).toBe(ownerUser._id.toString());
    });

    it("POST /api/v1/communities/:id/moderators - Moderator cannot promote members (Owner only)", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/moderators`)
            .set("Authorization", `Bearer ${modToken}`)
            .send({ targetUserId: outsiderUser._id });

        expect(res.status).toBe(403);
    });

    it("DELETE /api/v1/communities/:id/moderators/:userId - Owner can demote moderator back to member", async () => {
        const res = await request(app)
            .delete(`/api/v1/communities/${testCommunity._id}/moderators/${memberUser._id}`)
            .set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await Community.findById(testCommunity._id);
        expect(updated.moderators.map(id => id.toString())).not.toContain(memberUser._id.toString());
        expect(updated.members.map(id => id.toString())).toContain(memberUser._id.toString());

        const log = await ModerationLog.findOne({
            community: testCommunity._id,
            action: "DEMOTE_MODERATOR",
            targetUser: memberUser._id
        });
        expect(log).not.toBeNull();
    });

    it("POST /api/v1/communities/:id/members/:targetUserId/ban - Moderator cannot ban the Owner or fellow Moderator", async () => {
        const resOwner = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/members/${ownerUser._id}/ban`)
            .set("Authorization", `Bearer ${modToken}`)
            .send({ reason: "Unauthorized attempt" });

        expect(resOwner.status).toBe(403);
    });

    it("POST /api/v1/communities/:id/members/:targetUserId/ban - Moderator can ban regular member", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/members/${memberUser._id}/ban`)
            .set("Authorization", `Bearer ${modToken}`)
            .send({ reason: "Repeated spam" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await Community.findById(testCommunity._id);
        expect(updated.members.map(id => id.toString())).not.toContain(memberUser._id.toString());
        expect(updated.bannedUsers.some(b => b.user.toString() === memberUser._id.toString())).toBe(true);

        const log = await ModerationLog.findOne({
            community: testCommunity._id,
            action: "BAN_MEMBER",
            targetUser: memberUser._id
        });
        expect(log).not.toBeNull();
        expect(log.reason).toBe("Repeated spam");
    });

    it("GET /api/v1/communities/:id/banned - Moderator/Owner can view banned list", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${testCommunity._id}/banned`)
            .set("Authorization", `Bearer ${modToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.bannedUsers.length).toBe(1);
        expect(res.body.bannedUsers[0].user.username).toBe("cmod_member");
    });

    it("POST /api/v1/communities/:id/members/:targetUserId/unban - Owner/Moderator can unban a user", async () => {
        const res = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/members/${memberUser._id}/unban`)
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await Community.findById(testCommunity._id);
        expect(updated.bannedUsers.some(b => b.user.toString() === memberUser._id.toString())).toBe(false);

        const log = await ModerationLog.findOne({
            community: testCommunity._id,
            action: "UNBAN_MEMBER",
            targetUser: memberUser._id
        });
        expect(log).not.toBeNull();
    });

    it("Community Reports flow: submit report, list reports, and resolve with audit log", async () => {
        await Community.findByIdAndUpdate(testCommunity._id, { $addToSet: { members: memberUser._id } });

        const createRes = await request(app)
            .post(`/api/v1/communities/${testCommunity._id}/reports`)
            .set("Authorization", `Bearer ${memberToken}`)
            .send({
                targetUserId: outsiderUser._id,
                reason: "Harassment / Bullying",
                details: "Suspicious behavior"
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.success).toBe(true);
        const reportId = createRes.body.report._id;

        const listRes = await request(app)
            .get(`/api/v1/communities/${testCommunity._id}/reports?status=PENDING`)
            .set("Authorization", `Bearer ${modToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.reports.length).toBeGreaterThanOrEqual(1);

        const resolveRes = await request(app)
            .put(`/api/v1/communities/${testCommunity._id}/reports/${reportId}`)
            .set("Authorization", `Bearer ${modToken}`)
            .send({
                status: "RESOLVED",
                resolutionNotes: "Warning issued to user."
            });

        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.success).toBe(true);
        expect(resolveRes.body.report.status).toBe("RESOLVED");

        const log = await ModerationLog.findOne({
            community: testCommunity._id,
            action: "RESOLVE_REPORT"
        });
        expect(log).not.toBeNull();
    });

    it("GET /api/v1/communities/:id/moderation-logs - Moderator/Owner can view full audit trail", async () => {
        const res = await request(app)
            .get(`/api/v1/communities/${testCommunity._id}/moderation-logs`)
            .set("Authorization", `Bearer ${modToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.logs.length).toBeGreaterThanOrEqual(4);
    });
});
