require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Follow = require("../models/Follow");
const Notification = require("../models/Notification");

describe("Social & Follow System Test Suite", () => {
    let alice, bob, charlie;
    let aliceToken, bobToken, charlieToken;
    let aliceProfile, bobProfile, charlieProfile;
    let testPostId;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean test data
        await Identity.deleteMany({
            email: { $in: ["alice@test.com", "bob@test.com", "charlie@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["alice_user", "bob_user", "charlie_user"] }
        });
        await Post.deleteMany({});
        await Like.deleteMany({});
        await Comment.deleteMany({});
        await Follow.deleteMany({});
        await Notification.deleteMany({});

        // Alice (Public, Pro)
        alice = await Identity.create({
            email: "alice@test.com",
            username: "alice_user",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        aliceProfile = await Profile.create({
            userId: alice._id,
            username: "alice_user",
            displayName: "Alice Pro",
            privacy: "PUBLIC",
            isPro: true,
            avatarDecoration: "cyber-neon"
        });

        // Bob (Private, Free)
        bob = await Identity.create({
            email: "bob@test.com",
            username: "bob_user",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        bobProfile = await Profile.create({
            userId: bob._id,
            username: "bob_user",
            displayName: "Bob Private",
            privacy: "PRIVATE",
            isPro: false
        });

        // Charlie (Public, Free)
        charlie = await Identity.create({
            email: "charlie@test.com",
            username: "charlie_user",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        charlieProfile = await Profile.create({
            userId: charlie._id,
            username: "charlie_user",
            displayName: "Charlie User",
            privacy: "PUBLIC",
            isPro: false
        });

        aliceToken = jwt.sign({ userId: alice._id, username: alice.username }, process.env.JWT_SECRET);
        bobToken = jwt.sign({ userId: bob._id, username: bob.username }, process.env.JWT_SECRET);
        charlieToken = jwt.sign({ userId: charlie._id, username: charlie.username }, process.env.JWT_SECRET);
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["alice@test.com", "bob@test.com", "charlie@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["alice_user", "bob_user", "charlie_user"] }
        });
        await Post.deleteMany({});
        await Like.deleteMany({});
        await Comment.deleteMany({});
        await Follow.deleteMany({});
        await Notification.deleteMany({});
    }, 30000);

    // 1. Post Creation & Hydration
    describe("Post Lifecycle & Feeds", () => {
        it("Alice should create a post", async () => {
            const res = await request(app)
                .post("/api/v1/posts")
                .set("Authorization", `Bearer ${aliceToken}`)
                .send({
                    content: "Hello ANOY world from Alice!",
                    visibility: "PUBLIC"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.post.content).toBe("Hello ANOY world from Alice!");
            testPostId = res.body.post._id;
        });

        it("Explore feed should include Alice's post with hydrated Pro badge and avatar decoration", async () => {
            const res = await request(app)
                .get("/api/v1/posts")
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
            const post = res.body.posts.find((p) => p._id.toString() === testPostId.toString());
            expect(post).toBeDefined();
            expect(post.author.username).toBe("alice_user");
            expect(post.author.displayName).toBe("Alice Pro");
            expect(post.author.isPro).toBe(true);
            expect(post.author.avatarDecoration).toBe("cyber-neon");
        });

        it("Bob should like Alice's post", async () => {
            const res = await request(app)
                .post(`/api/v1/posts/${testPostId}/like`)
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it("Bob should add a comment on Alice's post", async () => {
            const res = await request(app)
                .post(`/api/v1/posts/${testPostId}/comments`)
                .set("Authorization", `Bearer ${bobToken}`)
                .send({ content: "Great first post Alice!" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.comment.content).toBe("Great first post Alice!");
        });

        it("Bob should unlike Alice's post", async () => {
            const res = await request(app)
                .delete(`/api/v1/posts/${testPostId}/like`)
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // 2. Follow System & Private Accounts
    describe("Follow System & Privacy", () => {
        it("Bob should follow Alice immediately (Public account)", async () => {
            const res = await request(app)
                .post(`/api/v1/follow/${alice.username}`)
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe("ACCEPTED");
        });

        it("Alice's personalized feed should include her own posts", async () => {
            const res = await request(app)
                .get("/api/v1/posts/feed")
                .set("Authorization", `Bearer ${aliceToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
        });

        it("Bob's personalized feed should include Alice's post because Bob follows Alice", async () => {
            const res = await request(app)
                .get("/api/v1/posts/feed")
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const found = res.body.posts.find((p) => p._id.toString() === testPostId.toString());
            expect(found).toBeDefined();
            expect(found.author.isPro).toBe(true);
        });

        it("Charlie should request to follow Bob (Private account -> PENDING)", async () => {
            const res = await request(app)
                .post(`/api/v1/follow/${bob.username}`)
                .set("Authorization", `Bearer ${charlieToken}`);

            expect(res.statusCode).toBe(201);
            expect(res.body.status).toBe("PENDING");
        });

        it("Bob should view pending follow requests and see Charlie", async () => {
            const res = await request(app)
                .get("/api/v1/follow/requests")
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.requests.length).toBe(1);
            expect(res.body.requests[0].follower.username).toBe("charlie_user");
        });

        it("Bob should accept Charlie's follow request", async () => {
            const res = await request(app)
                .post(`/api/v1/follow/requests/${charlie.username}/accept`)
                .set("Authorization", `Bearer ${bobToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it("Charlie's follow status for Bob should now be FOLLOWING", async () => {
            const res = await request(app)
                .get(`/api/v1/follow/${bob.username}/status`)
                .set("Authorization", `Bearer ${charlieToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.relationship).toBe("FOLLOWING");
        });
    });

    // 3. Security & Authorization
    describe("Security & Ownership Guardrails", () => {
        it("Charlie cannot delete Alice's post", async () => {
            const res = await request(app)
                .delete(`/api/v1/posts/${testPostId}`)
                .set("Authorization", `Bearer ${charlieToken}`);

            expect(res.statusCode).toBe(403);
        });

        it("Alice can delete her own post", async () => {
            const res = await request(app)
                .delete(`/api/v1/posts/${testPostId}`)
                .set("Authorization", `Bearer ${aliceToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
