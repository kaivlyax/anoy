require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Community = require("../models/Community");
const Post = require("../models/Post");
const AIConversation = require("../models/AIConversation");
const AIMessage = require("../models/AIMessage");
const { aiToolRegistry } = require("../services/aiToolRegistry");

describe("ANOY AI Assistant Test Suite", () => {
    let studentA, studentB, privateStudent;
    let tokenA, tokenB;
    let publicCommunity, privateCommunity;

    beforeAll(async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-32-chars-long-123456";
        process.env.AI_PROVIDER = "mock"; // Use deterministic mock/synthesizer in tests

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean previous test data
        await Identity.deleteMany({
            email: { $in: ["ai_student_a@test.com", "ai_student_b@test.com", "ai_private_user@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["ai_student_a", "ai_student_b", "ai_private_user"] }
        });
        await Community.deleteMany({ slug: { $in: ["ai-cs-hub", "ai-private-research"] } });
        await Post.deleteMany({ content: /AI Test Post/ });
        await AIConversation.deleteMany({});
        await AIMessage.deleteMany({});

        // Create Student A (Public)
        studentA = await Identity.create({
            email: "ai_student_a@test.com",
            username: "ai_student_a",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: studentA._id,
            username: "ai_student_a",
            displayName: "Student Alice",
            bio: "Machine Learning & Python enthusiast",
            skills: ["Python", "PyTorch", "Algorithms"],
            interests: ["Artificial Intelligence", "Robotics"],
            privacy: "PUBLIC"
        });

        // Create Student B (Public)
        studentB = await Identity.create({
            email: "ai_student_b@test.com",
            username: "ai_student_b",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: studentB._id,
            username: "ai_student_b",
            displayName: "Student Bob",
            bio: "React and Frontend developer",
            skills: ["React", "JavaScript", "CSS"],
            interests: ["Web Design"],
            privacy: "PUBLIC"
        });

        // Create Private User (Private Profile)
        privateStudent = await Identity.create({
            email: "ai_private_user@test.com",
            username: "ai_private_user",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: privateStudent._id,
            username: "ai_private_user",
            displayName: "Secret Agent",
            bio: "Hidden student bio",
            skills: ["Python", "Cryptography"],
            privacy: "PRIVATE" // PRIVATE PROFILE
        });

        tokenA = jwt.sign({ userId: studentA._id.toString() }, process.env.JWT_SECRET);
        tokenB = jwt.sign({ userId: studentB._id.toString() }, process.env.JWT_SECRET);

        // Create Public Community
        publicCommunity = await Community.create({
            name: "AI Computer Science Hub",
            slug: "ai-cs-hub",
            description: "A community for CS students.",
            owner: studentA._id,
            members: [studentA._id, studentB._id],
            isPrivate: false
        });

        // Create Private Community (Only Student A is a member)
        privateCommunity = await Community.create({
            name: "AI Private Research Lab",
            slug: "ai-private-research",
            description: "Restricted confidential research group.",
            owner: studentA._id,
            members: [studentA._id],
            isPrivate: true
        });

        // Create Public Post
        await Post.create({
            author: studentA._id,
            content: "AI Test Post: Exploring modern Graph Neural Networks on ANOY!",
            visibility: "PUBLIC",
            isDeleted: false
        });
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["ai_student_a@test.com", "ai_student_b@test.com", "ai_private_user@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["ai_student_a", "ai_student_b", "ai_private_user"] }
        });
        await Community.deleteMany({ slug: { $in: ["ai-cs-hub", "ai-private-research"] } });
        await Post.deleteMany({ content: /AI Test Post/ });
        await AIConversation.deleteMany({});
        await AIMessage.deleteMany({});
    }, 30000);

    describe("1. Validation & Authentication Guard", () => {
        test("Rejects unauthenticated AI chat request with 401", async () => {
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .send({ message: "How do I create a community?" });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test("Rejects empty or whitespace message with 400", async () => {
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ message: "   " });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/message text is required/i);
        });

        test("Rejects oversized message exceeding 1000 characters with 400", async () => {
            const longMessage = "a".repeat(1005);
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ message: longMessage });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/exceeds maximum allowed length/i);
        });

        test("Throws clear error when AI_PROVIDER is gemini but GEMINI_API_KEY is missing", async () => {
            const savedProvider = process.env.AI_PROVIDER;
            const savedKey = process.env.GEMINI_API_KEY;
            try {
                process.env.AI_PROVIDER = "gemini";
                delete process.env.GEMINI_API_KEY;
                delete process.env.AI_API_KEY;

                const { generateAssistantResponse } = require("../services/aiService");
                await expect(
                    generateAssistantResponse({ message: "explain linked list", currentUserId: studentA._id })
                ).rejects.toThrow(/Gemini API key is not configured/i);
            } finally {
                process.env.AI_PROVIDER = savedProvider;
                if (savedKey) process.env.GEMINI_API_KEY = savedKey;
            }
        });

        test("Throws error for unsupported provider name", async () => {
            const savedProvider = process.env.AI_PROVIDER;
            try {
                process.env.AI_PROVIDER = "invalid-provider-xyz";

                const { generateAssistantResponse } = require("../services/aiService");
                await expect(
                    generateAssistantResponse({ message: "hello", currentUserId: studentA._id })
                ).rejects.toThrow(/Unsupported AI_PROVIDER/i);
            } finally {
                process.env.AI_PROVIDER = savedProvider;
            }
        });
    });

    describe("2. ANOY Platform Feature Guidance & General Q&A", () => {
        test("Answers Meeting Room creation query accurately using ANOY help knowledge", async () => {
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ message: "How do I create a Meeting Room on ANOY?" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/meeting room/i);
            expect(res.body.conversationId).toBeDefined();
            expect(res.body.sources).toBeDefined();
            expect(res.body.sources.some((s) => s.type === "help")).toBe(true);
        });

        test("Answers general educational question (Binary Search)", async () => {
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ message: "Explain binary search algorithm" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/binary search/i);
        });
    });

    describe("3. Controlled Tool Permissions & Privacy Boundaries", () => {
        test("Public User Search tool: returns public profiles and excludes private profiles", async () => {
            const users = await aiToolRegistry.searchPublicUsers("Python");

            // Must find Student Alice
            expect(users.some((u) => u.username === "ai_student_a")).toBe(true);

            // Must NOT find Private Student
            expect(users.some((u) => u.username === "ai_private_user")).toBe(false);

            // Must NOT contain sensitive fields
            users.forEach((u) => {
                expect(u.email).toBeUndefined();
                expect(u.passwordHash).toBeUndefined();
                expect(u.verificationOTP).toBeUndefined();
            });
        });

        test("Public Community Search tool: returns public community", async () => {
            const comms = await aiToolRegistry.searchPublicCommunities("Computer Science", studentA._id);
            expect(comms.some((c) => c.slug === "ai-cs-hub")).toBe(true);
        });

        test("Private Community Access: authorized for member, denied for non-member", async () => {
            // Student A is OWNER of ai-private-research -> Allowed
            const authorizedContext = await aiToolRegistry.getAuthorizedCommunityContext(
                "ai-private-research",
                studentA._id
            );
            expect(authorizedContext.error).toBeUndefined();
            expect(authorizedContext.name).toBe("AI Private Research Lab");
            expect(authorizedContext.userRole).toBe("OWNER");

            // Student B is NOT a member -> Access Denied
            const unauthorizedContext = await aiToolRegistry.getAuthorizedCommunityContext(
                "ai-private-research",
                studentB._id
            );
            expect(unauthorizedContext.error).toBe("ACCESS_DENIED");
        });
    });

    describe("4. Conversation Sessions & Message Persistence", () => {
        let testConversationId;

        test("Creates conversation and stores both user and assistant turns in database", async () => {
            const res = await request(app)
                .post("/api/v1/ai/chat")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ message: "What is ANOY Pro?" });

            expect(res.statusCode).toBe(200);
            testConversationId = res.body.conversationId;

            // Check AIConversation in DB
            const conv = await AIConversation.findById(testConversationId);
            expect(conv).toBeDefined();
            expect(conv.user.toString()).toBe(studentA._id.toString());

            // Check AIMessage in DB
            const messages = await AIMessage.find({ conversation: testConversationId }).sort({ createdAt: 1 });
            expect(messages.length).toBe(2); // 1 user + 1 assistant
            expect(messages[0].role).toBe("user");
            expect(messages[0].content).toBe("What is ANOY Pro?");
            expect(messages[1].role).toBe("assistant");
        });

        test("GET /api/v1/ai/conversations - Returns user's active AI sessions", async () => {
            const res = await request(app)
                .get("/api/v1/ai/conversations")
                .set("Authorization", `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.conversations.length).toBeGreaterThan(0);
            expect(res.body.conversations[0]._id.toString()).toBe(testConversationId.toString());
        });

        test("GET /api/v1/ai/conversations/:id/messages - Returns message turn history", async () => {
            const res = await request(app)
                .get(`/api/v1/ai/conversations/${testConversationId}/messages`)
                .set("Authorization", `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.messages.length).toBe(2);
        });

        test("DELETE /api/v1/ai/conversations/:id - Deletes conversation and associated messages", async () => {
            const res = await request(app)
                .delete(`/api/v1/ai/conversations/${testConversationId}`)
                .set("Authorization", `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify deleted from DB
            const conv = await AIConversation.findById(testConversationId);
            expect(conv).toBeNull();
            const remainingMessages = await AIMessage.find({ conversation: testConversationId });
            expect(remainingMessages.length).toBe(0);
        });
    });

    describe("5. Gemini Transient Failure Handling, Exponential Backoff, & DM Privacy", () => {
        const {
            callGeminiWithRetry,
            isTransientError,
            isPermanentError,
            executeContextTools,
            generateAssistantResponse
        } = require("../services/aiService");
        const Conversation = require("../models/Conversation");
        const Message = require("../models/Message");

        test("isTransientError correctly identifies 503, 429, 500, network timeouts", () => {
            expect(isTransientError(new Error("503 UNAVAILABLE: This model is currently experiencing high demand."))).toBe(true);
            expect(isTransientError(new Error("429 RESOURCE_EXHAUSTED: Rate limit exceeded"))).toBe(true);
            expect(isTransientError(new Error("fetch failed (ECONNRESET)"))).toBe(true);
            expect(isTransientError({ status: 503, message: "Service Unavailable" })).toBe(true);
            expect(isTransientError({ status: 429, message: "Too Many Requests" })).toBe(true);
            expect(isTransientError({ status: 504, message: "Gateway Timeout" })).toBe(true);
        });

        test("isPermanentError correctly identifies 400, 401, 403, 404, invalid API key", () => {
            expect(isPermanentError(new Error("401 UNAUTHENTICATED: API_KEY_INVALID"))).toBe(true);
            expect(isPermanentError(new Error("403 PERMISSION_DENIED: User location not supported"))).toBe(true);
            expect(isPermanentError(new Error("400 INVALID_ARGUMENT: Malformed request payload"))).toBe(true);
            expect(isPermanentError(new Error("Gemini API key is not configured"))).toBe(true);
            expect(isPermanentError({ status: 401, message: "Unauthorized" })).toBe(true);
        });

        test("Successful Gemini response on first attempt", async () => {
            const mockGenerate = jest.fn().mockResolvedValue({
                text: "Binary search divides the sorted array in half."
            });
            const mockAi = { models: { generateContent: mockGenerate } };

            const result = await callGeminiWithRetry({
                ai: mockAi,
                modelName: "gemini-3.8-flash",
                fullPrompt: "Explain binary search",
                maxRetries: 3,
                delays: [1, 2, 4]
            });

            expect(result).toBe("Binary search divides the sorted array in half.");
            expect(mockGenerate).toHaveBeenCalledTimes(1);
        });

        test("First request gets 503 UNAVAILABLE, second succeeds on retry", async () => {
            const mockGenerate = jest
                .fn()
                .mockRejectedValueOnce(
                    new Error(
                        "503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
                    )
                )
                .mockResolvedValueOnce({
                    text: "Recovered successfully from transient 503 high demand."
                });

            const mockAi = { models: { generateContent: mockGenerate } };

            const result = await callGeminiWithRetry({
                ai: mockAi,
                modelName: "gemini-3.8-flash",
                fullPrompt: "Hello",
                maxRetries: 3,
                delays: [1, 2, 4]
            });

            expect(result).toBe("Recovered successfully from transient 503 high demand.");
            expect(mockGenerate).toHaveBeenCalledTimes(2);
        });

        test("Repeated 503s exhaust all 3 retries and return friendly temporary-service message", async () => {
            const mockGenerate = jest.fn().mockRejectedValue(
                new Error("503 UNAVAILABLE: This model is currently experiencing high demand.")
            );

            const mockAi = { models: { generateContent: mockGenerate } };

            await expect(
                callGeminiWithRetry({
                    ai: mockAi,
                    modelName: "gemini-3.8-flash",
                    fullPrompt: "Hello",
                    maxRetries: 3,
                    delays: [1, 1, 1]
                })
            ).rejects.toThrow("ANOY AI is temporarily busy. Please try again in a moment.");

            // 1 initial attempt + 3 retries = 4 total attempts
            expect(mockGenerate).toHaveBeenCalledTimes(4);
        });

        test("429 RESOURCE_EXHAUSTED triggers retry and recovers on next attempt", async () => {
            const mockGenerate = jest
                .fn()
                .mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED: Rate limit reached for default tier"))
                .mockResolvedValueOnce({
                    text: "Rate limit backed off successfully."
                });

            const mockAi = { models: { generateContent: mockGenerate } };

            const result = await callGeminiWithRetry({
                ai: mockAi,
                modelName: "gemini-3.8-flash",
                fullPrompt: "Hello",
                maxRetries: 3,
                delays: [1, 2, 4]
            });

            expect(result).toBe("Rate limit backed off successfully.");
            expect(mockGenerate).toHaveBeenCalledTimes(2);
        });

        test("Permanent authentication error (401 / invalid API key) fails immediately without retry", async () => {
            const mockGenerate = jest.fn().mockRejectedValue(
                new Error("401 UNAUTHENTICATED: API_KEY_INVALID. The provided API key is invalid.")
            );

            const mockAi = { models: { generateContent: mockGenerate } };

            await expect(
                callGeminiWithRetry({
                    ai: mockAi,
                    modelName: "gemini-3.8-flash",
                    fullPrompt: "Hello",
                    maxRetries: 3,
                    delays: [1000, 2000, 4000]
                })
            ).rejects.toThrow(/ANOY AI Error: 401 UNAUTHENTICATED/i);

            // Must NOT retry permanent error
            expect(mockGenerate).toHaveBeenCalledTimes(1);
        });

        test("Strict Privacy: Private 1-to-1 DMs are never exposed to AI context tools or prompts", async () => {
            // Create private 1-to-1 DM between Student A and Student B
            const dmConv = await Conversation.create({
                participants: [studentA._id, studentB._id],
                lastMessageAt: new Date()
            });

            const dmMsg = await Message.create({
                conversation: dmConv._id,
                sender: studentA._id,
                text: "Top Secret Private DM: Exam answers 12345",
                readBy: [studentA._id]
            });

            dmConv.lastMessage = dmMsg._id;
            await dmConv.save();

            // Execute context tools querying about Student A, Student B, or general chats
            const contextAlice = await executeContextTools("Show me what Alice and Bob are discussing in private", studentA._id);
            const contextBob = await executeContextTools("Find messages from Bob", studentB._id);

            // Neither context payload should ever contain private DM content
            expect(contextAlice.contextString).not.toContain("Top Secret Private DM");
            expect(contextAlice.contextString).not.toContain("Exam answers 12345");
            expect(contextBob.contextString).not.toContain("Top Secret Private DM");

            // Clean up test DM
            await Conversation.findByIdAndDelete(dmConv._id);
            await Message.deleteMany({ conversation: dmConv._id });
        });
    });
});

