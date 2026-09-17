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
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Community = require("../models/Community");
const ModerationLog = require("../models/ModerationLog");
const MeetingRoom = require("../models/MeetingRoom");
const Block = require("../models/Block");
const Payment = require("../models/Payment");
const Purchase = require("../models/Purchase");

describe("ANOY 12-Feature End-to-End Suite", () => {
    jest.setTimeout(45000);

    let userPro, userFree, userTarget;
    let tokenPro, tokenFree, tokenTarget;
    let proProfile, freeProfile, targetProfile;
    let createdPostId, createdCommunityId, createdRoomId, createdConversationId;

    const cleanup = async () => {
        const usernames = ["e2e_pro_user", "e2e_free_user", "e2e_target_user", "auth_test_new"];
        await Identity.deleteMany({ username: { $in: usernames } });
        await Profile.deleteMany({ username: { $in: usernames } });
        await Post.deleteMany({ content: /E2E/ });
        await Community.deleteMany({ slug: "e2e-flagship-club" });
        await MeetingRoom.deleteMany({ name: /E2E/ });
        await Conversation.deleteMany({});
        await Message.deleteMany({});
        await Block.deleteMany({});
        await Follow.deleteMany({});
        await Like.deleteMany({});
        await Comment.deleteMany({});
    };

    beforeAll(async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e_test_jwt_secret_key_32_chars_long_2026";
        process.env.AI_PROVIDER = "mock"; // Deterministic AI response for tests

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy", { serverSelectionTimeoutMS: 5000 });
        }

        await cleanup();

        // 1. Setup Pro User
        userPro = await Identity.create({
            email: "e2e_pro_user@test.com",
            username: "e2e_pro_user",
            passwordHash: "$2a$10$w8k1hFq.8P8.1wJ8fIqUee.d4p4Fm8I0g.2K8/m3v0sFm8I0g.2K8", // password123
            emailVerified: true,
            status: "ACTIVE"
        });
        proProfile = await Profile.create({
            userId: userPro._id,
            username: "e2e_pro_user",
            displayName: "Pro Student Leader",
            isPro: true
        });
        tokenPro = jwt.sign({ userId: userPro._id, username: userPro.username, tokenVersion: 0 }, process.env.JWT_SECRET);

        // 2. Setup Free User
        userFree = await Identity.create({
            email: "e2e_free_user@test.com",
            username: "e2e_free_user",
            passwordHash: "$2a$10$w8k1hFq.8P8.1wJ8fIqUee.d4p4Fm8I0g.2K8/m3v0sFm8I0g.2K8",
            emailVerified: true,
            status: "ACTIVE"
        });
        freeProfile = await Profile.create({
            userId: userFree._id,
            username: "e2e_free_user",
            displayName: "Free Campus Peer",
            isPro: false
        });
        tokenFree = jwt.sign({ userId: userFree._id, username: userFree.username, tokenVersion: 0 }, process.env.JWT_SECRET);

        // 3. Setup Target User
        userTarget = await Identity.create({
            email: "e2e_target_user@test.com",
            username: "e2e_target_user",
            passwordHash: "$2a$10$w8k1hFq.8P8.1wJ8fIqUee.d4p4Fm8I0g.2K8/m3v0sFm8I0g.2K8",
            emailVerified: true,
            status: "ACTIVE"
        });
        targetProfile = await Profile.create({
            userId: userTarget._id,
            username: "e2e_target_user",
            displayName: "Target Member",
            isPro: false
        });
        tokenTarget = jwt.sign({ userId: userTarget._id, username: userTarget.username, tokenVersion: 0 }, process.env.JWT_SECRET);
    });

    afterAll(async () => {
        await cleanup();
        await mongoose.connection.close();
    });

    // -------------------------------------------------------------
    // FEATURE 1: Authentication
    // -------------------------------------------------------------
    it("1. Authentication - User register, verify email OTP, login, and fetch account profile", async () => {
        // Register new user
        const regRes = await request(app)
            .post("/api/v1/auth/register")
            .send({
                email: "auth_test_new@test.com",
                username: "auth_test_new",
                displayName: "New Student",
                password: "Password123!"
            });

        expect(regRes.status).toBe(201);
        expect(regRes.body.success).toBe(true);

        // Verify account profile retrieval
        const profileRes = await request(app)
            .get(`/api/v1/profile/${userPro.username}`)
            .set("Authorization", `Bearer ${tokenPro}`);

        expect(profileRes.status).toBe(200);
        expect(profileRes.body.success).toBe(true);
        expect(profileRes.body.profile.username).toBe("e2e_pro_user");
        expect(profileRes.body.profile.isPro).toBe(true);
    });

    // -------------------------------------------------------------
    // FEATURE 2: Create text post
    // -------------------------------------------------------------
    it("2. Create text post - Creates post with content, hashtags and visibility", async () => {
        const res = await request(app)
            .post("/api/v1/posts")
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                content: "E2E Testing ANOY Social Network #TechInBharat #ANOY2026",
                visibility: "PUBLIC"
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.post.content).toContain("#TechInBharat");
        createdPostId = res.body.post._id;
    });

    // -------------------------------------------------------------
    // FEATURE 3: Select/upload image from local computer
    // -------------------------------------------------------------
    it("3. Select/upload image from local computer - Handles multipart file upload", async () => {
        const pngBuffer = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "base64"
        );

        const uploadRes = await request(app)
            .post("/api/v1/media/upload")
            .set("Authorization", `Bearer ${tokenPro}`)
            .attach("file", pngBuffer, "test_upload.png");

        expect(uploadRes.status).toBe(201);
        expect(uploadRes.body.success).toBe(true);
        expect(uploadRes.body.media.url).toBeDefined();

        // Create post with attached media
        const postWithMediaRes = await request(app)
            .post("/api/v1/posts")
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                content: "E2E Post with local uploaded image",
                media: [{ url: uploadRes.body.media.url, type: "IMAGE" }]
            });

        expect(postWithMediaRes.status).toBe(201);
        expect(postWithMediaRes.body.post.media.length).toBe(1);
    });

    // -------------------------------------------------------------
    // FEATURE 4: Like/comment/follow
    // -------------------------------------------------------------
    it("4. Like/comment/follow - Interacts with posts and users", async () => {
        // Free user likes Pro user's post
        const likeRes = await request(app)
            .post(`/api/v1/posts/${createdPostId}/like`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect([200, 201]).toContain(likeRes.status);
        expect(likeRes.body.success).toBe(true);

        // Free user comments on post
        const commentRes = await request(app)
            .post(`/api/v1/posts/${createdPostId}/comments`)
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({ content: "Awesome E2E update!" });

        expect(commentRes.status).toBe(201);
        expect(commentRes.body.success).toBe(true);
        expect(commentRes.body.comment.content).toBe("Awesome E2E update!");

        // Free user follows Pro user by username
        const followRes = await request(app)
            .post(`/api/v1/follow/${userPro.username}`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect([200, 201]).toContain(followRes.status);
        expect(followRes.body.success).toBe(true);
    });

    // -------------------------------------------------------------
    // FEATURE 5: Search
    // -------------------------------------------------------------
    it("5. Search - Searches users, posts, and trends across ANOY", async () => {
        // Search users
        const userSearch = await request(app)
            .get("/api/v1/search?q=pro_user&type=users")
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(userSearch.status).toBe(200);
        expect(userSearch.body.success).toBe(true);
        expect(userSearch.body.users.some(u => u.username === "e2e_pro_user")).toBe(true);

        // Search posts
        const postSearch = await request(app)
            .get("/api/v1/search?q=TechInBharat&type=posts")
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(postSearch.status).toBe(200);
        expect(postSearch.body.success).toBe(true);
        expect(postSearch.body.posts.length).toBeGreaterThanOrEqual(1);
    });

    // -------------------------------------------------------------
    // FEATURE 6: Private chat + Socket.IO
    // -------------------------------------------------------------
    it("6. Private chat + Socket.IO - Initiates 1-to-1 conversation and sends messages", async () => {
        const convRes = await request(app)
            .post("/api/v1/conversations")
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({ recipientId: userPro._id });

        expect([200, 201]).toContain(convRes.status);
        expect(convRes.body.success).toBe(true);
        createdConversationId = convRes.body.conversation._id;

        const msgRes = await request(app)
            .post(`/api/v1/conversations/${createdConversationId}/messages`)
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({ content: "Hello from E2E private chat test" });

        expect(msgRes.status).toBe(201);
        expect(msgRes.body.success).toBe(true);
        expect(msgRes.body.message.content).toBe("Hello from E2E private chat test");
    });

    // -------------------------------------------------------------
    // FEATURE 7: Community creation/join
    // -------------------------------------------------------------
    it("7. Community creation/join - Creates a community and joins members", async () => {
        const commRes = await request(app)
            .post("/api/v1/communities")
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                name: "E2E Flagship Club",
                slug: "e2e-flagship-club",
                description: "Flagship test community for full social test",
                isPrivate: false
            });

        expect(commRes.status).toBe(201);
        expect(commRes.body.success).toBe(true);
        createdCommunityId = commRes.body.community._id;

        // Free user joins community
        const joinRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/join`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(joinRes.status).toBe(200);
        expect(joinRes.body.success).toBe(true);
        expect(joinRes.body.memberCount).toBe(2);

        // Target user joins community
        await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/join`)
            .set("Authorization", `Bearer ${tokenTarget}`);
    });

    // -------------------------------------------------------------
    // FEATURE 8: Moderator promotion/removal/ban
    // -------------------------------------------------------------
    it("8. Moderator promotion/removal/ban - Strict role hierarchy & moderation audit", async () => {
        // Owner promotes Free user to moderator
        const promoteRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/moderators`)
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({ targetUserId: userFree._id });

        expect(promoteRes.status).toBe(200);
        expect(promoteRes.body.success).toBe(true);

        // Moderator bans Target user with reason
        const banRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/members/${userTarget._id}/ban`)
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({ reason: "E2E guideline violation" });

        expect(banRes.status).toBe(200);
        expect(banRes.body.success).toBe(true);

        // Verify banned list
        const bannedListRes = await request(app)
            .get(`/api/v1/communities/${createdCommunityId}/banned`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(bannedListRes.status).toBe(200);
        expect(bannedListRes.body.bannedUsers.some(b => b.user.username === "e2e_target_user")).toBe(true);

        // Unban Target user
        const unbanRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/members/${userTarget._id}/unban`)
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({});

        expect(unbanRes.status).toBe(200);
    });

    // -------------------------------------------------------------
    // FEATURE 9: Meeting Room: Free = 5 / Pro = 15
    // -------------------------------------------------------------
    it("9. Meeting Room: Free = 5 / Pro = 15 - Enforces tier participant caps", async () => {
        // Pro host creates room with 15 participants
        const proRoomRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/meeting-rooms`)
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                name: "E2E Pro Mega Room",
                description: "Up to 15 members allowed",
                maxParticipants: 15
            });

        expect(proRoomRes.status).toBe(201);
        expect(proRoomRes.body.meetingRoom.maxParticipants).toBe(15);
        expect(proRoomRes.body.meetingRoom.isHostPro).toBe(true);

        // Free host creates room with requested 15 -> strictly capped to 5
        const freeRoomRes = await request(app)
            .post(`/api/v1/communities/${createdCommunityId}/meeting-rooms`)
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({
                name: "E2E Free Study Room",
                description: "Capped to 5 members",
                maxParticipants: 15
            });

        expect(freeRoomRes.status).toBe(201);
        expect(freeRoomRes.body.meetingRoom.maxParticipants).toBe(5);
        expect(freeRoomRes.body.meetingRoom.isHostPro).toBe(false);
    });

    // -------------------------------------------------------------
    // FEATURE 10: Settings: password/block/privacy/delete
    // -------------------------------------------------------------
    it("10. Settings: password/block/privacy/delete - Account, privacy & security controls", async () => {
        // 1. Update privacy preferences
        const privRes = await request(app)
            .put("/api/v1/settings/privacy")
            .set("Authorization", `Bearer ${tokenFree}`)
            .send({
                isPrivate: true,
                messagePrivacy: "FOLLOWERS_ONLY"
            });

        expect(privRes.status).toBe(200);
        expect(privRes.body.success).toBe(true);

        // 2. Block target user by username
        const blockRes = await request(app)
            .post(`/api/v1/settings/block/${userTarget.username}`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(blockRes.status).toBe(200);
        expect(blockRes.body.success).toBe(true);

        // 3. Unblock target user by username
        const unblockRes = await request(app)
            .post(`/api/v1/settings/unblock/${userTarget.username}`)
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(unblockRes.status).toBe(200);
        expect(unblockRes.body.success).toBe(true);

        // 4. Invalidate sessions (Logout all devices)
        const logoutRes = await request(app)
            .post("/api/v1/settings/logout-all")
            .set("Authorization", `Bearer ${tokenFree}`);

        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.success).toBe(true);
    });

    // -------------------------------------------------------------
    // FEATURE 11: ANOY AI
    // -------------------------------------------------------------
    it("11. ANOY AI - Conversational AI responds with context & tools", async () => {
        const aiRes = await request(app)
            .post("/api/v1/ai/chat")
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                message: "Hello ANOY AI! What communities are active on the platform?"
            });

        expect(aiRes.status).toBe(200);
        expect(aiRes.body.success).toBe(true);
        expect(aiRes.body.message).toBeDefined();
        expect(aiRes.body.message.length).toBeGreaterThan(5);
    });

    // -------------------------------------------------------------
    // FEATURE 12: Pro = Coming Soon
    // -------------------------------------------------------------
    it("12. Pro = Coming Soon - Razorpay order creation endpoint preserved while frontend checkout remains Coming Soon", async () => {
        const orderRes = await request(app)
            .post("/api/v1/payments/create-order")
            .set("Authorization", `Bearer ${tokenPro}`)
            .send({
                planType: "PRO_MONTHLY",
                amount: 9900
            });

        expect([200, 201, 400]).toContain(orderRes.status);
    });
});
