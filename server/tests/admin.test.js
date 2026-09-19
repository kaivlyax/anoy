require("dotenv").config();
const request = require("supertest");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: Client } = require("socket.io-client");
const bcrypt = require("bcryptjs");
const app = require("../app");
const { initSocket } = require("../socket");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Community = require("../models/Community");
const AdminAuditLog = require("../models/AdminAuditLog");

describe("Platform-Level Admin System & Security Tests", () => {
    let server;
    let ioServer;
    let port;

    let adminUser, regularUser, platformModUser, platformSupportUser, targetUser;
    let adminToken, regularToken, platformModToken, platformSupportToken, targetToken;
    let conversation;
    let testCommunity;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "super-secret-admin-test-jwt-key-32-chars-long";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        server = http.createServer(app);
        ioServer = initSocket(server);

        await new Promise((resolve) => {
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });

        const testEmails = [
            "admin_test@test.com",
            "user_test@test.com",
            "mod_test@test.com",
            "support_test@test.com",
            "target_test@test.com"
        ];

        await Identity.deleteMany({ email: { $in: testEmails } });
        await Profile.deleteMany({ username: { $in: ["admin_test", "user_test", "mod_test", "support_test", "target_test"] } });
        await AdminAuditLog.deleteMany({});
        await Community.deleteMany({ slug: "admin-test-community" });

        const passwordHash = await bcrypt.hash("TestPass123!", 10);

        // 1. Create ADMIN
        adminUser = await Identity.create({
            email: "admin_test@test.com",
            username: "admin_test",
            passwordHash,
            emailVerified: true,
            status: "ACTIVE",
            role: "ADMIN"
        });
        await Profile.create({ userId: adminUser._id, username: "admin_test", displayName: "Admin User" });
        adminToken = jwt.sign(
            { userId: adminUser._id.toString(), username: adminUser.username, tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // 2. Create Regular USER
        regularUser = await Identity.create({
            email: "user_test@test.com",
            username: "user_test",
            passwordHash,
            emailVerified: true,
            status: "ACTIVE",
            role: "USER"
        });
        await Profile.create({ userId: regularUser._id, username: "user_test", displayName: "Regular User" });
        regularToken = jwt.sign(
            { userId: regularUser._id.toString(), username: regularUser.username, tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // 3. Create Platform MODERATOR
        platformModUser = await Identity.create({
            email: "mod_test@test.com",
            username: "mod_test",
            passwordHash,
            emailVerified: true,
            status: "ACTIVE",
            role: "MODERATOR"
        });
        await Profile.create({ userId: platformModUser._id, username: "mod_test", displayName: "Platform Mod" });
        platformModToken = jwt.sign(
            { userId: platformModUser._id.toString(), username: platformModUser.username, tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // 4. Create Platform SUPPORT
        platformSupportUser = await Identity.create({
            email: "support_test@test.com",
            username: "support_test",
            passwordHash,
            emailVerified: true,
            status: "ACTIVE",
            role: "SUPPORT"
        });
        await Profile.create({ userId: platformSupportUser._id, username: "support_test", displayName: "Platform Support" });
        platformSupportToken = jwt.sign(
            { userId: platformSupportUser._id.toString(), username: platformSupportUser.username, tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // 5. Create Target User (to be banned/reviewed)
        targetUser = await Identity.create({
            email: "target_test@test.com",
            username: "target_test",
            passwordHash,
            emailVerified: true,
            status: "ACTIVE",
            role: "USER"
        });
        await Profile.create({ userId: targetUser._id, username: "target_test", displayName: "Target User" });
        targetToken = jwt.sign(
            { userId: targetUser._id.toString(), username: targetUser.username, tokenVersion: 0 },
            process.env.JWT_SECRET
        );

        // Create a 1-to-1 conversation between regularUser and targetUser with messages
        conversation = await Conversation.create({
            participants: [regularUser._id, targetUser._id],
            lastMessageAt: new Date()
        });

        await Message.create({
            conversation: conversation._id,
            sender: regularUser._id,
            content: "Hey, check out this private message",
            messageType: "TEXT"
        });

        await Message.create({
            conversation: conversation._id,
            sender: targetUser._id,
            content: "Received private message loud and clear",
            messageType: "TEXT"
        });

        // Create a community with platformModUser as community owner to test community moderation separation
        testCommunity = await Community.create({
            name: "Admin Test Community",
            slug: "admin-test-community",
            owner: platformModUser._id,
            members: [platformModUser._id, regularUser._id, targetUser._id],
            moderators: [regularUser._id],
            isPrivate: false
        });
    }, 30000);

    afterAll(async () => {
        const testEmails = [
            "admin_test@test.com",
            "user_test@test.com",
            "mod_test@test.com",
            "support_test@test.com",
            "target_test@test.com"
        ];
        await Identity.deleteMany({ email: { $in: testEmails } });
        await Profile.deleteMany({ username: { $in: ["admin_test", "user_test", "mod_test", "support_test", "target_test"] } });
        await AdminAuditLog.deleteMany({});
        await Community.deleteMany({ slug: "admin-test-community" });
        if (conversation) {
            await Message.deleteMany({ conversation: conversation._id });
            await Conversation.findByIdAndDelete(conversation._id);
        }
        if (ioServer) {
            ioServer.close();
        }
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    }, 30000);

    // =========================================================================
    // 1. Role-Based Access Control (RBAC) to Admin Routes
    // =========================================================================
    describe("1. Role-Based Access Control on Admin Endpoints", () => {
        test("ADMIN can access GET /api/v1/admin/users", async () => {
            const res = await request(app)
                .get("/api/v1/admin/users")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.users)).toBe(true);
            expect(res.body.total).toBeGreaterThanOrEqual(5);
        });

        test("Regular USER cannot access admin endpoints (403 Forbidden)", async () => {
            const res = await request(app)
                .get("/api/v1/admin/users")
                .set("Authorization", `Bearer ${regularToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/administrator privilege required/i);
        });

        test("Platform MODERATOR cannot access admin endpoints (403 Forbidden)", async () => {
            const res = await request(app)
                .get("/api/v1/admin/users")
                .set("Authorization", `Bearer ${platformModToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/administrator privilege required/i);
        });

        test("Platform SUPPORT cannot access admin endpoints (403 Forbidden)", async () => {
            const res = await request(app)
                .get("/api/v1/admin/users")
                .set("Authorization", `Bearer ${platformSupportToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/administrator privilege required/i);
        });

        test("Unauthenticated request is rejected (401 Unauthorized)", async () => {
            const res = await request(app).get("/api/v1/admin/users");

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test("ADMIN can view specific user details via GET /api/v1/admin/users/:id", async () => {
            const res = await request(app)
                .get(`/api/v1/admin/users/${targetUser._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user.username).toBe("target_test");
            expect(res.body.user.passwordHash).toBeUndefined();
        });
    });

    // =========================================================================
    // 2. Global User Ban, Session Invalidation & Unban
    // =========================================================================
    describe("2. Global User Ban & Unban Management", () => {
        test("ADMIN can ban a user with a reason and create an audit log", async () => {
            const banRes = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/ban`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Repeated Terms of Service violation" });

            expect(banRes.statusCode).toBe(200);
            expect(banRes.body.success).toBe(true);
            expect(banRes.body.user.status).toBe("BANNED");
            expect(banRes.body.user.banReason).toBe("Repeated Terms of Service violation");

            // Verify in DB that status is BANNED and tokenVersion incremented
            const updatedInDb = await Identity.findById(targetUser._id);
            expect(updatedInDb.status).toBe("BANNED");
            expect(updatedInDb.tokenVersion).toBe(1);
            expect(updatedInDb.bannedBy.toString()).toBe(adminUser._id.toString());

            // Verify immutable audit log creation
            const log = await AdminAuditLog.findOne({
                action: "USER_BAN",
                targetUser: targetUser._id
            });
            expect(log).not.toBeNull();
            expect(log.admin.toString()).toBe(adminUser._id.toString());
            expect(log.reason).toBe("Repeated Terms of Service violation");
        });

        test("Banned user cannot log in (403 Forbidden)", async () => {
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: "target_test@test.com",
                    password: "TestPass123!"
                });

            expect(loginRes.statusCode).toBe(403);
            expect(loginRes.body.success).toBe(false);
            expect(loginRes.body.message).toMatch(/account has been banned/i);
        });

        test("Banned user's pre-existing active session/JWT is rejected on API endpoints", async () => {
            const profileRes = await request(app)
                .get("/api/v1/profile/me")
                .set("Authorization", `Bearer ${targetToken}`);

            expect(profileRes.statusCode).toBe(403);
            expect(profileRes.body.success).toBe(false);
            expect(profileRes.body.message).toMatch(/account has been banned/i);
        });

        test("Banned user cannot authenticate with Socket.IO", (done) => {
            const clientSocket = Client(`http://localhost:${port}`, {
                auth: { token: targetToken },
                transports: ["websocket"]
            });

            clientSocket.on("connect_error", (err) => {
                expect(err.message).toMatch(/inactive/i);
                clientSocket.disconnect();
                done();
            });

            clientSocket.on("connect", () => {
                clientSocket.disconnect();
                done(new Error("Banned user should not be able to connect to Socket.IO"));
            });
        });

        test("ADMIN cannot ban self", async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${adminUser._id}/ban`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Self ban attempt" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/cannot ban your own/i);
        });

        test("ADMIN cannot ban an already banned user", async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/ban`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Duplicate ban attempt" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/already banned/i);
        });

        test("ADMIN can unban a user and restore access", async () => {
            const unbanRes = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/unban`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Account appealed and verified" });

            expect(unbanRes.statusCode).toBe(200);
            expect(unbanRes.body.success).toBe(true);
            expect(unbanRes.body.user.status).toBe("ACTIVE");
            expect(unbanRes.body.user.banReason).toBeNull();

            // Verify unbanned user can now log in successfully
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: "target_test@test.com",
                    password: "TestPass123!"
                });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);
            expect(loginRes.body.token).toBeDefined();

            // Verify audit log created for unban
            const log = await AdminAuditLog.findOne({
                action: "USER_UNBAN",
                targetUser: targetUser._id
            });
            expect(log).not.toBeNull();
            expect(log.reason).toBe("Account appealed and verified");
        });
    });

    // =========================================================================
    // 3. Targeted Private-Message Review with Mandatory Reason & Audit Logging
    // =========================================================================
    describe("3. Private-Message Review Authorization & Audit Logging", () => {
        test("Private message review strictly requires a mandatory non-empty reason", async () => {
            const res = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/mandatory.*reason.*required/i);
        });

        test("Private message review with whitespace-only reason is rejected", async () => {
            const res = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages?reason=%20%20%20`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/mandatory.*reason.*required/i);
        });

        test("Non-admin users cannot review private messages (403 Forbidden)", async () => {
            const userRes = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages?reason=Investigating`)
                .set("Authorization", `Bearer ${regularToken}`);
            expect(userRes.statusCode).toBe(403);

            const modRes = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages?reason=Investigating`)
                .set("Authorization", `Bearer ${platformModToken}`);
            expect(modRes.statusCode).toBe(403);

            const supportRes = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages?reason=Investigating`)
                .set("Authorization", `Bearer ${platformSupportToken}`);
            expect(supportRes.statusCode).toBe(403);
        });

        test("ADMIN can lookup user conversations via GET /api/v1/admin/users/:id/conversations", async () => {
            const res = await request(app)
                .get(`/api/v1/admin/users/${targetUser._id}/conversations`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user._id.toString()).toBe(targetUser._id.toString());
            expect(Array.isArray(res.body.conversations)).toBe(true);
            expect(res.body.conversations.length).toBeGreaterThanOrEqual(1);

            const conv = res.body.conversations.find((c) => c._id.toString() === conversation._id.toString());
            expect(conv).toBeDefined();
            expect(conv.participants.some((p) => p.username === "user_test")).toBe(true);
        });

        test("ADMIN with valid reason can review conversation and creates an immutable audit log", async () => {
            const reviewReason = "Subpoena / safety report investigation case #9842";
            const res = await request(app)
                .get(`/api/v1/admin/conversations/${conversation._id}/messages?reason=${encodeURIComponent(reviewReason)}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.conversation._id.toString()).toBe(conversation._id.toString());
            expect(res.body.messages).toHaveLength(2);
            const contents = res.body.messages.map((m) => m.content);
            expect(contents).toContain("Hey, check out this private message");
            expect(contents).toContain("Received private message loud and clear");

            // Verify audit log record exists with exact details
            const auditLog = await AdminAuditLog.findOne({
                action: "PRIVATE_MESSAGE_REVIEW",
                targetConversation: conversation._id
            });

            expect(auditLog).not.toBeNull();
            expect(auditLog.admin.toString()).toBe(adminUser._id.toString());
            expect(auditLog.reason).toBe(reviewReason);
            expect(auditLog.targetUsers.map((u) => u.toString())).toEqual(
                expect.arrayContaining([regularUser._id.toString(), targetUser._id.toString()])
            );
        });

        test("Audit logs endpoint GET /api/v1/admin/audit-logs returns recorded actions", async () => {
            const res = await request(app)
                .get("/api/v1/admin/audit-logs")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.total).toBeGreaterThanOrEqual(3); // ban, unban, message review
        });

        test("AdminAuditLog entries are immutable and prevent updates", async () => {
            const log = await AdminAuditLog.findOne({ action: "PRIVATE_MESSAGE_REVIEW" });
            expect(log).not.toBeNull();

            await expect(
                AdminAuditLog.updateOne({ _id: log._id }, { reason: "Tampered reason" })
            ).rejects.toThrow(/immutable/i);
        });
    });

    // =========================================================================
    // 4. Community Moderation Coexistence
    // =========================================================================
    describe("4. Community-Level Moderation Coexistence", () => {
        test("Community owner/moderator can still ban user locally within community", async () => {
            const res = await request(app)
                .post(`/api/v1/communities/${testCommunity._id}/members/${targetUser._id}/ban`)
                .set("Authorization", `Bearer ${platformModToken}`)
                .send({ reason: "Spamming in community chat" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify community ban list
            const commInDb = await Community.findById(testCommunity._id);
            expect(commInDb.bannedUsers.some((b) => b.user.equals(targetUser._id))).toBe(true);

            // But targetUser's global platform status remains ACTIVE
            const globalUser = await Identity.findById(targetUser._id);
            expect(globalUser.status).toBe("ACTIVE");
        });
    });

    // =========================================================================
    // 5. Granular Platform Interaction Restriction & Auto-Expiry
    // =========================================================================
    describe("5. Granular Platform Interaction Restriction & Auto-Expiry", () => {
        test("ADMIN can restrict a user temporarily with a duration and reason", async () => {
            const res = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/restrict`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    reason: "Posting abusive content in comments",
                    duration: "24h"
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user.restriction.isRestricted).toBe(true);
            expect(res.body.user.restriction.reason).toBe("Posting abusive content in comments");
            expect(res.body.user.restriction.expiresAt).not.toBeNull();

            // Verify immutable audit log
            const log = await AdminAuditLog.findOne({
                action: "USER_RESTRICT",
                targetUser: targetUser._id
            });
            expect(log).not.toBeNull();
            expect(log.admin.toString()).toBe(adminUser._id.toString());
            expect(log.reason).toBe("Posting abusive content in comments");
        });

        test("Restricted user CAN still log in (read-only access preserved)", async () => {
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: "target_test@test.com",
                    password: "TestPass123!"
                });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);
            expect(loginRes.body.token).toBeDefined();
            targetToken = loginRes.body.token;
        });

        test("Restricted user CAN read their own profile", async () => {
            const res = await request(app)
                .get("/api/v1/profile/me")
                .set("Authorization", `Bearer ${targetToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.profile.username).toBe("target_test");
            expect(res.body.profile.restriction.isRestricted).toBe(true);
            expect(res.body.profile.restriction.reason).toBe("Posting abusive content in comments");
        });

        test("Restricted user CANNOT create a post (403 Forbidden with restricted flag)", async () => {
            const res = await request(app)
                .post("/api/v1/posts")
                .set("Authorization", `Bearer ${targetToken}`)
                .send({
                    content: "This post should be blocked by restriction",
                    visibility: "PUBLIC"
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.restricted).toBe(true);
            expect(res.body.message).toMatch(/restricted/i);
        });

        test("Restricted user CANNOT send direct messages via REST", async () => {
            const res = await request(app)
                .post(`/api/v1/conversations/${conversation._id}/messages`)
                .set("Authorization", `Bearer ${targetToken}`)
                .send({
                    content: "This DM should be blocked"
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.restricted).toBe(true);
            expect(res.body.message).toMatch(/restricted/i);
        });

        test("Restricted user CANNOT send message via Socket.IO", (done) => {
            const clientSocket = Client(`http://localhost:${port}`, {
                auth: { token: targetToken },
                transports: ["websocket"]
            });

            clientSocket.on("connect", () => {
                clientSocket.emit("send_message", {
                    conversationId: conversation._id.toString(),
                    content: "Socket DM test"
                }, (response) => {
                    try {
                        expect(response).toBeDefined();
                        expect(response.success).toBe(false);
                        expect(response.restricted).toBe(true);
                        expect(response.message).toMatch(/restricted/i);
                        clientSocket.disconnect();
                        done();
                    } catch (err) {
                        clientSocket.disconnect();
                        done(err);
                    }
                });
            });
        });

        test("ADMIN cannot restrict themselves or other ADMINs", async () => {
            const selfRes = await request(app)
                .post(`/api/v1/admin/users/${adminUser._id}/restrict`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Self restriction" });

            expect(selfRes.statusCode).toBe(400);
            expect(selfRes.body.success).toBe(false);
            expect(selfRes.body.message).toMatch(/cannot restrict your own/i);
        });

        test("Expired temporary restriction automatically lifts interaction blocking", async () => {
            // Set expiresAt to the past (1 minute ago)
            await Identity.findByIdAndUpdate(targetUser._id, {
                $set: {
                    "restriction.expiresAt": new Date(Date.now() - 60 * 1000)
                }
            });

            // Post creation should now succeed without any manual admin action
            const res = await request(app)
                .post("/api/v1/posts")
                .set("Authorization", `Bearer ${targetToken}`)
                .send({
                    content: "Restriction has expired, post should succeed!",
                    visibility: "PUBLIC"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
        });

        test("ADMIN can permanently restrict and then explicitly unrestrict a user", async () => {
            // 1. Restrict permanently
            const restrictRes = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/restrict`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    reason: "Permanent restriction for severe violation",
                    expiresAt: null
                });

            expect(restrictRes.statusCode).toBe(200);
            expect(restrictRes.body.user.restriction.isRestricted).toBe(true);
            expect(restrictRes.body.user.restriction.expiresAt).toBeNull();

            // 2. Try posting -> blocked
            const blockedRes = await request(app)
                .post("/api/v1/posts")
                .set("Authorization", `Bearer ${targetToken}`)
                .send({
                    content: "Should be blocked permanently",
                    visibility: "PUBLIC"
                });
            expect(blockedRes.statusCode).toBe(403);
            expect(blockedRes.body.restricted).toBe(true);

            // 3. Unrestrict user
            const unrestrictRes = await request(app)
                .post(`/api/v1/admin/users/${targetUser._id}/unrestrict`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    reason: "Appeal accepted by safety team"
                });

            expect(unrestrictRes.statusCode).toBe(200);
            expect(unrestrictRes.body.success).toBe(true);
            expect(unrestrictRes.body.user.restriction.isRestricted).toBe(false);
            expect(unrestrictRes.body.user.restriction.reason).toBeNull();

            // Verify USER_UNRESTRICT audit log
            const log = await AdminAuditLog.findOne({
                action: "USER_UNRESTRICT",
                targetUser: targetUser._id
            });
            expect(log).not.toBeNull();
            expect(log.reason).toBe("Appeal accepted by safety team");

            // 4. Try posting -> succeeds
            const successRes = await request(app)
                .post("/api/v1/posts")
                .set("Authorization", `Bearer ${targetToken}`)
                .send({
                    content: "Unrestricted user posting freely again!",
                    visibility: "PUBLIC"
                });
            expect(successRes.statusCode).toBe(201);
            expect(successRes.body.success).toBe(true);
        });
    });
});
