require("dotenv").config();
const request = require("supertest");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: Client } = require("socket.io-client");
const app = require("../app");
const { initSocket } = require("../socket");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

describe("Real-Time Messaging & Conversations Suite", () => {
    let server;
    let port;
    let userA, userB, userC;
    let tokenA, tokenB, tokenC;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        // Connect to Mongo test DB
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        server = http.createServer(app);
        initSocket(server);

        await new Promise((resolve) => {
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });

        // Clean test documents
        await Identity.deleteMany({ email: { $in: ["usera@test.com", "userb@test.com", "userc@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["usera", "userb", "userc"] } });
        await Conversation.deleteMany({});
        await Message.deleteMany({});

        // Create test identities
        userA = await Identity.create({
            email: "usera@test.com",
            username: "usera",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: userA._id, username: "usera", displayName: "User A" });

        userB = await Identity.create({
            email: "userb@test.com",
            username: "userb",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: userB._id, username: "userb", displayName: "User B" });

        userC = await Identity.create({
            email: "userc@test.com",
            username: "userc",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: userC._id, username: "userc", displayName: "User C" });

        tokenA = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET);
        tokenB = jwt.sign({ userId: userB._id }, process.env.JWT_SECRET);
        tokenC = jwt.sign({ userId: userC._id }, process.env.JWT_SECRET);
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({ email: { $in: ["usera@test.com", "userb@test.com", "userc@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["usera", "userb", "userc"] } });
        await Conversation.deleteMany({});
        await Message.deleteMany({});
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    }, 30000);

    let conversationId;

    describe("REST API - Conversation Lifecycle", () => {
        test("POST /api/v1/conversations - Creates new conversation between User A and User B", async () => {
            const res = await request(app)
                .post("/api/v1/conversations")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ username: "userb" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.conversation).toBeDefined();
            expect(res.body.conversation.participants).toHaveLength(2);
            conversationId = res.body.conversation._id;
        });

        test("POST /api/v1/conversations - Returns existing conversation if already created", async () => {
            const res = await request(app)
                .post("/api/v1/conversations")
                .set("Authorization", `Bearer ${tokenB}`)
                .send({ recipientId: userA._id });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.conversation._id.toString()).toBe(conversationId.toString());
        });

        test("POST /api/v1/conversations - Prevents self-messaging", async () => {
            const res = await request(app)
                .post("/api/v1/conversations")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ username: "usera" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test("GET /api/v1/conversations - Lists conversations for User A", async () => {
            const res = await request(app)
                .get("/api/v1/conversations")
                .set("Authorization", `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.conversations).toHaveLength(1);
            expect(res.body.conversations[0]._id.toString()).toBe(conversationId.toString());
        });

        test("POST /api/v1/conversations/:id/messages - User A sends message to conversation", async () => {
            const res = await request(app)
                .post(`/api/v1/conversations/${conversationId}/messages`)
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ content: "Hello User B from User A!" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message.content).toBe("Hello User B from User A!");
        });

        test("GET /api/v1/conversations/:id/messages - User B retrieves messages", async () => {
            const res = await request(app)
                .get(`/api/v1/conversations/${conversationId}/messages`)
                .set("Authorization", `Bearer ${tokenB}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.messages).toHaveLength(1);
            expect(res.body.messages[0].content).toBe("Hello User B from User A!");
        });

        test("Authorization Guard: User C cannot access User A & B's conversation", async () => {
            const getRes = await request(app)
                .get(`/api/v1/conversations/${conversationId}/messages`)
                .set("Authorization", `Bearer ${tokenC}`);

            expect(getRes.statusCode).toBe(403);
            expect(getRes.body.success).toBe(false);

            const postRes = await request(app)
                .post(`/api/v1/conversations/${conversationId}/messages`)
                .set("Authorization", `Bearer ${tokenC}`)
                .send({ content: "Intrusion attempt" });

            expect(postRes.statusCode).toBe(403);
            expect(postRes.body.success).toBe(false);
        });

        test("GET /api/v1/conversations/unread-count - User B has 1 unread message", async () => {
            const res = await request(app)
                .get("/api/v1/conversations/unread-count")
                .set("Authorization", `Bearer ${tokenB}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(1);
        });
    });

    describe("Socket.IO - Real-Time Events", () => {
        let clientSocketA;
        let clientSocketB;

        afterEach((done) => {
            let remaining = 2;
            const finished = () => {
                remaining--;
                if (remaining <= 0) done();
            };

            if (clientSocketA?.connected) {
                clientSocketA.once("disconnect", finished);
                clientSocketA.disconnect();
            } else {
                finished();
            }

            if (clientSocketB?.connected) {
                clientSocketB.once("disconnect", finished);
                clientSocketB.disconnect();
            } else {
                finished();
            }
        });

        test("Socket authentication & real-time message exchange", (done) => {
            clientSocketA = Client(`http://localhost:${port}`, {
                auth: { token: tokenA }
            });

            clientSocketB = Client(`http://localhost:${port}`, {
                auth: { token: tokenB }
            });

            clientSocketB.on("connect", () => {
                clientSocketB.emit("join_conversation", { conversationId: conversationId.toString() }, (joinRes) => {
                    expect(joinRes.success).toBe(true);
                });
            });

            clientSocketB.on("new_message", ({ conversationId: convId, message }) => {
                expect(convId).toBe(conversationId.toString());
                expect(message.content).toBe("Real-time socket message test");
                done();
            });

            clientSocketA.on("connect", () => {
                clientSocketA.emit("join_conversation", { conversationId: conversationId.toString() }, () => {
                    clientSocketA.emit("send_message", {
                        conversationId: conversationId.toString(),
                        content: "Real-time socket message test"
                    });
                });
            });
        });

        test("Typing indicators & read receipts", (done) => {
            clientSocketA = Client(`http://localhost:${port}`, {
                auth: { token: tokenA }
            });

            clientSocketB = Client(`http://localhost:${port}`, {
                auth: { token: tokenB }
            });

            clientSocketB.on("connect", () => {
                clientSocketB.emit("join_conversation", { conversationId: conversationId.toString() });
            });

            clientSocketB.on("typing:start", ({ conversationId: convId, username }) => {
                expect(convId).toBe(conversationId.toString());
                expect(username).toBe("usera");

                // Test marking as read
                clientSocketB.emit("mark_read", { conversationId: conversationId.toString() }, (markRes) => {
                    expect(markRes.success).toBe(true);
                });
            });

            clientSocketA.on("messages_read", ({ conversationId: convId }) => {
                expect(convId).toBe(conversationId.toString());
                done();
            });

            clientSocketA.on("connect", () => {
                clientSocketA.emit("join_conversation", { conversationId: conversationId.toString() }, () => {
                    // Send an unread message first so mark_read has a message to mark
                    clientSocketA.emit("send_message", {
                        conversationId: conversationId.toString(),
                        content: "Unread message for read receipt test"
                    }, () => {
                        clientSocketA.emit("typing:start", { conversationId: conversationId.toString() });
                    });
                });
            });
        });
    });
});
