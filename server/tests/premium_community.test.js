require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Purchase = require("../models/Purchase");
const Community = require("../models/Community");
const CommunityBoost = require("../models/CommunityBoost");

describe("Premium / Pro & Community System Test Suite", () => {
    let userFree, userPro, userThird;
    let tokenFree, tokenPro, tokenThird;
    let profileFree, profilePro;
    let community;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean previous test data
        await Identity.deleteMany({
            email: { $in: ["freeuser@test.com", "prouser@test.com", "thirduser@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["freeuser", "prouser", "thirduser"] }
        });
        await Community.deleteMany({ slug: "test-dev-hub" });
        await CommunityBoost.deleteMany({});
        await Purchase.deleteMany({});

        // Create Free User
        userFree = await Identity.create({
            email: "freeuser@test.com",
            username: "freeuser",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        profileFree = await Profile.create({
            userId: userFree._id,
            username: "freeuser",
            displayName: "Free User",
            isPro: false,
            proPlan: "FREE"
        });

        // Create Pro User
        userPro = await Identity.create({
            email: "prouser@test.com",
            username: "prouser",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        profilePro = await Profile.create({
            userId: userPro._id,
            username: "prouser",
            displayName: "Pro User",
            isPro: true,
            proPlan: "PRO_MONTHLY",
            proExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            unlockedEmojiPacks: ["default", "pack_neon_flair"]
        });

        // Create Third User
        userThird = await Identity.create({
            email: "thirduser@test.com",
            username: "thirduser",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({
            userId: userThird._id,
            username: "thirduser",
            displayName: "Third User"
        });

        tokenFree = jwt.sign({ userId: userFree._id.toString() }, process.env.JWT_SECRET);
        tokenPro = jwt.sign({ userId: userPro._id.toString() }, process.env.JWT_SECRET);
        tokenThird = jwt.sign({ userId: userThird._id.toString() }, process.env.JWT_SECRET);
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["freeuser@test.com", "prouser@test.com", "thirduser@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["freeuser", "prouser", "thirduser"] }
        });
        await Community.deleteMany({ slug: "test-dev-hub" });
        await CommunityBoost.deleteMany({});
        await Purchase.deleteMany({});
    }, 30000);

    describe("Premium Store & Mock Checkout", () => {
        test("GET /api/v1/premium/catalog - Returns catalog with Pro status and annotated items", async () => {
            const res = await request(app)
                .get("/api/v1/premium/catalog")
                .set("Authorization", `Bearer ${tokenFree}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.catalog.plans).toBeDefined();
            expect(res.body.catalog.avatarFrames.length).toBeGreaterThan(0);
            expect(res.body.userStatus.isPro).toBe(false);
            expect(res.body.userStatus.uploadLimits.maxLabel).toBe("5MB");
        });

        test("GET /api/v1/premium/status - Pro user receives 25MB upload limit", async () => {
            const res = await request(app)
                .get("/api/v1/premium/status")
                .set("Authorization", `Bearer ${tokenPro}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.isPro).toBe(true);
            expect(res.body.uploadLimits.maxLabel).toMatch(/25MB/i);
        });

        test("POST /api/v1/premium/checkout-mock - Rejects Pro plan purchase and directs to verified payment", async () => {
            const res = await request(app)
                .post("/api/v1/premium/checkout-mock")
                .set("Authorization", `Bearer ${tokenFree}`)
                .send({ itemId: "plan_pro_monthly" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/verified Razorpay checkout/i);
        });

        test("POST /api/v1/premium/checkout-mock - Unlocks non-exclusive cosmetic item", async () => {
            const res = await request(app)
                .post("/api/v1/premium/checkout-mock")
                .set("Authorization", `Bearer ${tokenFree}`)
                .send({ itemId: "frame_aurora_emerald" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.purchase.provider).toBe("MOCK");
            expect(res.body.profile.unlockedDecorations).toContain("frame_aurora_emerald");
        });

        test("POST /api/v1/premium/activate - Equips and unequips avatar frame", async () => {
            // Equip frame_neon_glow
            const equipRes = await request(app)
                .post("/api/v1/premium/activate")
                .set("Authorization", `Bearer ${tokenPro}`)
                .send({ type: "AVATAR_FRAME", itemId: "frame_neon_glow" });

            expect(equipRes.statusCode).toBe(200);
            expect(equipRes.body.profile.avatarDecoration).toBe("frame_neon_glow");

            // Unequip
            const unequipRes = await request(app)
                .post("/api/v1/premium/deactivate")
                .set("Authorization", `Bearer ${tokenPro}`)
                .send({ type: "AVATAR_FRAME" });

            expect(unequipRes.statusCode).toBe(200);
            expect(unequipRes.body.profile.avatarDecoration).toBe("");
        });
    });

    describe("Community Architecture & Roles", () => {
        test("POST /api/v1/communities - Creates community with creator as OWNER and member", async () => {
            const res = await request(app)
                .post("/api/v1/communities")
                .set("Authorization", `Bearer ${tokenPro}`)
                .send({
                    name: "Test Dev Hub",
                    slug: "test-dev-hub",
                    description: "A hub for developers."
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.community.slug).toBe("test-dev-hub");
            expect(res.body.community.owner.toString()).toBe(userPro._id.toString());
            expect(res.body.community.members).toContainEqual(userPro._id.toString());

            community = res.body.community;
        });

        test("POST /api/v1/communities/:id/join - Third user joins community as MEMBER", async () => {
            const res = await request(app)
                .post(`/api/v1/communities/${community._id}/join`)
                .set("Authorization", `Bearer ${tokenThird}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.userRole).toBe("MEMBER");
            expect(res.body.memberCount).toBe(2);
        });

        test("POST /api/v1/communities/:id/moderators - Owner promotes Third user to MODERATOR", async () => {
            const res = await request(app)
                .post(`/api/v1/communities/${community._id}/moderators`)
                .set("Authorization", `Bearer ${tokenPro}`)
                .send({ targetUserId: userThird._id.toString() });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test("Authorization Guard: Non-owner cannot update community settings", async () => {
            const res = await request(app)
                .put(`/api/v1/communities/${community._id}`)
                .set("Authorization", `Bearer ${tokenThird}`)
                .send({ description: "Hacked description" });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/owner has permission/i);
        });
    });

    describe("Community Boosting & Levels", () => {
        test("POST /api/v1/communities/:id/boost - Pro user boosts community and increments level", async () => {
            const res = await request(app)
                .post(`/api/v1/communities/${community._id}/boost`)
                .set("Authorization", `Bearer ${tokenPro}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.boostCount).toBe(1);
            expect(res.body.isBoosted).toBe(true);
        });

        test("POST /api/v1/communities/:id/boost - Prevents duplicate active boost by same user", async () => {
            const res = await request(app)
                .post(`/api/v1/communities/${community._id}/boost`)
                .set("Authorization", `Bearer ${tokenPro}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/already boosted/i);
        });

        test("GET /api/v1/communities - Boosted communities ranked at top", async () => {
            const res = await request(app)
                .get("/api/v1/communities?boosted=true")
                .set("Authorization", `Bearer ${tokenPro}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.communities.length).toBeGreaterThan(0);
            expect(res.body.communities[0].slug).toBe("test-dev-hub");
            expect(res.body.communities[0].isBoosted).toBe(true);
        });
    });
});
