require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Follow = require("../models/Follow");
const Community = require("../models/Community");
const Notification = require("../models/Notification");

describe("Phase 1C — Deleted Account Data Exposure & Privacy Security Tests", () => {
    let activeUser, deletedUser, viewerUser;
    let activeToken, viewerToken;
    let testCommunity;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean test collections
        await Identity.deleteMany({
            email: { $in: ["p1c_active@test.com", "p1c_deleted@test.com", "p1c_viewer@test.com", "p1c_victim@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["p1c_active", "p1c_deleted", "p1c_viewer", "p1c_victim"] }
        });
        await Community.deleteMany({ slug: "p1c-test-community" });

        const hashedPassword = await bcrypt.hash("Password123!", 10);

        // Active user
        activeUser = await Identity.create({
            email: "p1c_active@test.com",
            username: "p1c_active",
            passwordHash: hashedPassword,
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: activeUser._id,
            username: "p1c_active",
            displayName: "Active Account",
            bio: "Active engineer searching for opportunities",
            privacy: "PUBLIC",
            skills: ["JavaScript", "Security"]
        });

        // Deleted user (Status: DELETED, legacy dangling Profile)
        deletedUser = await Identity.create({
            email: "p1c_deleted@test.com",
            username: "p1c_deleted",
            passwordHash: hashedPassword,
            emailVerified: true,
            status: "DELETED"
        });
        // Intentionally create a dangling profile to test defense-in-depth on query endpoints
        await Profile.create({
            userId: deletedUser._id,
            username: "p1c_deleted",
            displayName: "Deleted Secret Account",
            bio: "This bio should never be exposed after deletion",
            privacy: "PUBLIC",
            skills: ["SecretSkill"]
        });

        // Viewer user
        viewerUser = await Identity.create({
            email: "p1c_viewer@test.com",
            username: "p1c_viewer",
            passwordHash: hashedPassword,
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: viewerUser._id,
            username: "p1c_viewer",
            displayName: "Viewer Account",
            privacy: "PUBLIC"
        });

        // Community with active, viewer, and deleted members
        testCommunity = await Community.create({
            name: "Phase 1C Community",
            slug: "p1c-test-community",
            description: "Community for security testing",
            owner: activeUser._id,
            moderators: [activeUser._id],
            members: [activeUser._id, viewerUser._id, deletedUser._id]
        });

        activeToken = jwt.sign({ userId: activeUser._id, username: activeUser.username }, process.env.JWT_SECRET);
        viewerToken = jwt.sign({ userId: viewerUser._id, username: viewerUser.username }, process.env.JWT_SECRET);
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["p1c_active@test.com", "p1c_deleted@test.com", "p1c_viewer@test.com", "p1c_victim@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["p1c_active", "p1c_deleted", "p1c_viewer", "p1c_victim"] }
        });
        await Community.deleteMany({ slug: "p1c-test-community" });
        await Post.deleteMany({});
        await Follow.deleteMany({});
        await Comment.deleteMany({});
        await Like.deleteMany({});
        await Notification.deleteMany({});
    }, 30000);

    describe("1. Public Profile Endpoints Defense-in-Depth", () => {
        it("Active user profile is accessible", async () => {
            const res = await request(app).get("/api/v1/profile/p1c_active");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.profile.username).toBe("p1c_active");
        });

        it("Deleted user profile returns 404 Not Found", async () => {
            const res = await request(app).get("/api/v1/profile/p1c_deleted");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("Profile not found");
        });

        it("Deleted user stats returns 404 Not Found", async () => {
            const res = await request(app).get("/api/v1/profile/p1c_deleted/stats");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("Profile not found");
        });
    });

    describe("2. User Search & Discovery Defense-in-Depth", () => {
        it("User search (/api/v1/users/search) excludes deleted accounts", async () => {
            const res = await request(app).get("/api/v1/users/search?q=p1c");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const usernames = res.body.users.map((u) => u.username);
            expect(usernames).toContain("p1c_active");
            expect(usernames).toContain("p1c_viewer");
            expect(usernames).not.toContain("p1c_deleted");
        });

        it("User discover (/api/v1/users/discover) excludes deleted accounts", async () => {
            const res = await request(app).get("/api/v1/users/discover");
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const usernames = res.body.users.map((u) => u.username);
            expect(usernames).not.toContain("p1c_deleted");
        });

        it("Search users (/api/v1/search/users) excludes deleted accounts", async () => {
            const res = await request(app)
                .get("/api/v1/search/users?q=p1c")
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const usernames = res.body.users.map((u) => u.username);
            expect(usernames).toContain("p1c_active");
            expect(usernames).not.toContain("p1c_deleted");
        });

        it("Unified search (/api/v1/search) excludes deleted accounts in user results", async () => {
            const res = await request(app)
                .get("/api/v1/search?q=p1c")
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const usernames = res.body.users.map((u) => u.username);
            expect(usernames).toContain("p1c_active");
            expect(usernames).not.toContain("p1c_deleted");
        });
    });

    describe("3. Social & Follow Endpoints Defense-in-Depth", () => {
        it("Cannot follow a deleted user (returns 404)", async () => {
            const res = await request(app)
                .post("/api/v1/follow/p1c_deleted")
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("User not found");
        });

        it("Cannot unfollow a deleted user (returns 404)", async () => {
            const res = await request(app)
                .delete("/api/v1/follow/p1c_deleted")
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("User not found");
        });

        it("Get followers of a deleted user returns 404", async () => {
            const res = await request(app).get("/api/v1/follow/p1c_deleted/followers");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("User not found");
        });

        it("Get following of a deleted user returns 404", async () => {
            const res = await request(app).get("/api/v1/follow/p1c_deleted/following");
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("User not found");
        });

        it("Follow status for deleted user returns 404", async () => {
            const res = await request(app)
                .get("/api/v1/follow/p1c_deleted/status")
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("User not found");
        });
    });

    describe("4. Conversations Defense-in-Depth", () => {
        it("Cannot start conversation with deleted user by username", async () => {
            const res = await request(app)
                .post("/api/v1/conversations")
                .set("Authorization", `Bearer ${viewerToken}`)
                .send({ username: "p1c_deleted" });
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("Recipient user not found");
        });

        it("Cannot start conversation with deleted user by recipientId", async () => {
            const res = await request(app)
                .post("/api/v1/conversations")
                .set("Authorization", `Bearer ${viewerToken}`)
                .send({ recipientId: deletedUser._id.toString() });
            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("Recipient user not found");
        });
    });

    describe("5. Communities Defense-in-Depth", () => {
        it("Community details exclude deleted members from members list", async () => {
            const res = await request(app)
                .get(`/api/v1/communities/${testCommunity._id}`)
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const memberUsernames = res.body.community.members.map((m) => m.username);
            expect(memberUsernames).not.toContain("p1c_deleted");
        });

        it("Community member list endpoint excludes deleted members", async () => {
            const res = await request(app)
                .get(`/api/v1/communities/${testCommunity._id}/members`)
                .set("Authorization", `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const memberUsernames = res.body.members.map((m) => m.username);
            expect(memberUsernames).not.toContain("p1c_deleted");
        });
    });

    describe("6. Complete End-to-End Account Deletion Lifecycle", () => {
        let victimUser, victimToken, victimPost;

        beforeAll(async () => {
            const hashedPassword = await bcrypt.hash("Password123!", 10);
            victimUser = await Identity.create({
                email: "p1c_victim@test.com",
                username: "p1c_victim",
                passwordHash: hashedPassword,
                emailVerified: true,
                status: "ACTIVE"
            });
            await Profile.create({
                userId: victimUser._id,
                username: "p1c_victim",
                displayName: "Victim Account",
                privacy: "PUBLIC"
            });

            victimToken = jwt.sign({ userId: victimUser._id, username: victimUser.username }, process.env.JWT_SECRET);

            // Victim creates post
            victimPost = await Post.create({
                author: victimUser._id,
                content: "Victim secret post that should be soft-deleted",
                visibility: "PUBLIC"
            });

            // Victim comments on post
            await Comment.create({
                author: victimUser._id,
                post: victimPost._id,
                content: "Victim comment"
            });

            // Victim joins test community
            testCommunity.members.push(victimUser._id);
            await testCommunity.save();

            // Viewer follows victim
            await Follow.create({
                follower: viewerUser._id,
                following: victimUser._id,
                status: "ACCEPTED"
            });
        });

        it("Account deletion cleans up Profile, Posts, Comments, Follows, Communities", async () => {
            const deleteRes = await request(app)
                .post("/api/v1/settings/delete-account")
                .set("Authorization", `Bearer ${victimToken}`)
                .send({
                    password: "Password123!",
                    confirmationText: "DELETE"
                });

            expect(deleteRes.statusCode).toBe(200);
            expect(deleteRes.body.success).toBe(true);

            // Verify Identity status is DELETED
            const updatedIdentity = await Identity.findById(victimUser._id);
            expect(updatedIdentity.status).toBe("DELETED");

            // Verify Profile is removed
            const profile = await Profile.findOne({ userId: victimUser._id });
            expect(profile).toBeNull();

            // Verify Post is soft-deleted
            const post = await Post.findById(victimPost._id);
            expect(post.isDeleted).toBe(true);

            // Verify Comment is soft-deleted
            const comment = await Comment.findOne({ author: victimUser._id });
            expect(comment.isDeleted).toBe(true);

            // Verify Follow relationships were deleted
            const follows = await Follow.find({
                $or: [{ follower: victimUser._id }, { following: victimUser._id }]
            });
            expect(follows.length).toBe(0);

            // Verify Community member list no longer includes victim
            const comm = await Community.findById(testCommunity._id);
            expect(comm.members.map((m) => m.toString())).not.toContain(victimUser._id.toString());
        });

        it("Deleted victim profile cannot be accessed", async () => {
            const res = await request(app).get("/api/v1/profile/p1c_victim");
            expect(res.statusCode).toBe(404);
        });

        it("Deleted victim cannot be searched", async () => {
            const res = await request(app).get("/api/v1/users/search?q=p1c_victim");
            expect(res.statusCode).toBe(200);
            expect(res.body.users.length).toBe(0);
        });
    });
});
