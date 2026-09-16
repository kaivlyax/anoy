require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const Payment = require("../models/Payment");
const Purchase = require("../models/Purchase");

// Mock Razorpay SDK orders.create
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => {
        return {
            orders: {
                create: jest.fn().mockImplementation(async (options) => {
                    const nodeCrypto = require("crypto");
                    const mockOrderId = `order_${nodeCrypto.randomBytes(8).toString("hex")}`;
                    return {
                        id: mockOrderId,
                        entity: "order",
                        amount: options.amount,
                        amount_paid: 0,
                        amount_due: options.amount,
                        currency: options.currency || "INR",
                        receipt: options.receipt,
                        status: "created",
                        attempts: 0,
                        notes: options.notes,
                        created_at: Math.floor(Date.now() / 1000)
                    };
                })
            }
        };
    });
});

describe("Razorpay Standard Checkout & Payment API Test Suite", () => {
    let userA, userB;
    let tokenA, tokenB;
    let profileA, profileB;

    const TEST_KEY_ID = "rzp_test_mockKeyId123";
    const TEST_KEY_SECRET = "mockSecretKeyForTestingHMAC123456";

    beforeAll(async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-32-chars-long-123456";
        process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
        process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean test collections
        await Identity.deleteMany({
            email: { $in: ["razoruserA@test.com", "razoruserB@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["razoruserA", "razoruserB"] }
        });
        await Payment.deleteMany({});
        await Purchase.deleteMany({});

        // Create User A
        userA = await Identity.create({
            email: "razoruserA@test.com",
            username: "razoruserA",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        profileA = await Profile.create({
            userId: userA._id,
            username: "razoruserA",
            displayName: "Razor User A",
            isPro: false,
            proPlan: "FREE"
        });

        // Create User B
        userB = await Identity.create({
            email: "razoruserB@test.com",
            username: "razoruserB",
            passwordHash: "hash123",
            emailVerified: true,
            status: "ACTIVE"
        });
        profileB = await Profile.create({
            userId: userB._id,
            username: "razoruserB",
            displayName: "Razor User B",
            isPro: false,
            proPlan: "FREE"
        });

        tokenA = jwt.sign({ userId: userA._id.toString() }, process.env.JWT_SECRET);
        tokenB = jwt.sign({ userId: userB._id.toString() }, process.env.JWT_SECRET);
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["razoruserA@test.com", "razoruserB@test.com"] }
        });
        await Profile.deleteMany({
            username: { $in: ["razoruserA", "razoruserB"] }
        });
        await Payment.deleteMany({});
        await Purchase.deleteMany({});
    }, 30000);

    describe("1. Order Creation - POST /api/v1/payments/create-order", () => {
        test("Rejects unauthenticated order creation with 401", async () => {
            const res = await request(app)
                .post("/api/v1/payments/create-order")
                .send({ plan: "PRO_MONTHLY" });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test("Rejects request with missing plan identifier with 400", async () => {
            const res = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/plan identifier is required/i);
        });

        test("Rejects invalid plan name with 400", async () => {
            const res = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ plan: "INVALID_PLAN_NAME" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/invalid plan/i);
        });

        test("Successfully creates Razorpay order for Monthly Pro (₹99 = 9900 paise)", async () => {
            const res = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ plan: "PRO_MONTHLY" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.order_id).toBeDefined();
            expect(res.body.order_id).toMatch(/^order_/);
            expect(res.body.amount).toBe(9900);
            expect(res.body.currency).toBe("INR");
            expect(res.body.key_id).toBe(TEST_KEY_ID);
            expect(res.body.plan).toBe("PRO_MONTHLY");

            // Verify Key Secret is never exposed in response
            expect(res.body.key_secret).toBeUndefined();
            expect(JSON.stringify(res.body)).not.toContain(TEST_KEY_SECRET);

            // Verify Payment record in database
            const payment = await Payment.findOne({ razorpayOrderId: res.body.order_id });
            expect(payment).toBeDefined();
            expect(payment.user.toString()).toBe(userA._id.toString());
            expect(payment.amount).toBe(9900);
            expect(payment.status).toBe("created");
            expect(payment.paidAt).toBeNull();
        });

        test("Accepts short plan alias 'annual' and creates order (₹799 = 79900 paise)", async () => {
            const res = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ plan: "annual" });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.amount).toBe(79900);
            expect(res.body.plan).toBe("PRO_ANNUAL");
        });
    });

    describe("2. Payment Verification & Pro Entitlement - POST /api/v1/payments/verify", () => {
        let createdOrderId;

        beforeEach(async () => {
            const orderRes = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({ plan: "PRO_MONTHLY" });

            createdOrderId = orderRes.body.order_id;
        });

        test("Rejects unauthenticated payment verification with 401", async () => {
            const res = await request(app)
                .post("/api/v1/payments/verify")
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: "pay_12345",
                    razorpay_signature: "sig12345"
                });

            expect(res.statusCode).toBe(401);
        });

        test("Rejects verification when missing required fields with 400", async () => {
            const res = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    razorpay_order_id: createdOrderId
                    // missing payment_id and signature
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/missing required verification fields/i);
        });

        test("Rejects forged/invalid HMAC signature with 400 and does NOT grant Pro", async () => {
            const fakePaymentId = "pay_fake_99999";
            const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

            const res = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: fakePaymentId,
                    razorpay_signature: forgedSignature
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/invalid payment signature/i);

            // Verify User A profile is STILL NOT PRO
            const profile = await Profile.findOne({ userId: userA._id });
            expect(profile.isPro).toBe(false);

            // Verify payment record marked failed
            const payment = await Payment.findOne({ razorpayOrderId: createdOrderId });
            expect(payment.status).toBe("failed");
        });

        test("Rejects verification when User B attempts to verify User A's order with 403", async () => {
            const paymentId = "pay_valid_userb_attempt";
            const validSignature = crypto
                .createHmac("sha256", TEST_KEY_SECRET)
                .update(`${createdOrderId}|${paymentId}`)
                .digest("hex");

            const res = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenB}`) // User B token
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/unauthorized/i);

            // Ensure neither user gained Pro
            const profileAAfter = await Profile.findOne({ userId: userA._id });
            const profileBAfter = await Profile.findOne({ userId: userB._id });
            expect(profileAAfter.isPro).toBe(false);
            expect(profileBAfter.isPro).toBe(false);
        });

        test("Successfully verifies valid HMAC signature, marks payment paid, and activates Pro", async () => {
            const paymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;
            const validSignature = crypto
                .createHmac("sha256", TEST_KEY_SECRET)
                .update(`${createdOrderId}|${paymentId}`)
                .digest("hex");

            const res = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.profile.isPro).toBe(true);
            expect(res.body.profile.proPlan).toBe("PRO_MONTHLY");
            expect(res.body.profile.proExpiresAt).toBeDefined();

            // Verify DB state
            const payment = await Payment.findOne({ razorpayOrderId: createdOrderId });
            expect(payment.status).toBe("paid");
            expect(payment.razorpayPaymentId).toBe(paymentId);
            expect(payment.paidAt).not.toBeNull();

            const profile = await Profile.findOne({ userId: userA._id });
            expect(profile.isPro).toBe(true);
            expect(profile.proPlan).toBe("PRO_MONTHLY");
            expect(profile.unlockedEmojiPacks).toContain("pack_neon_flair");

            // Verify Purchase audit record created
            const purchase = await Purchase.findOne({ transactionId: paymentId });
            expect(purchase).toBeDefined();
            expect(purchase.paymentStatus).toBe("COMPLETED");
            expect(purchase.provider).toBe("RAZORPAY");
        });

        test("Idempotency: Re-verifying already paid order succeeds safely without double-extending", async () => {
            const paymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;
            const validSignature = crypto
                .createHmac("sha256", TEST_KEY_SECRET)
                .update(`${createdOrderId}|${paymentId}`)
                .digest("hex");

            // First verification
            await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature
                });

            const profileAfterFirst = await Profile.findOne({ userId: userA._id });
            const expiryFirst = new Date(profileAfterFirst.proExpiresAt).getTime();

            // Second verification call (duplicate request)
            const secondRes = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenA}`)
                .send({
                    razorpay_order_id: createdOrderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature
                });

            expect(secondRes.statusCode).toBe(200);
            expect(secondRes.body.success).toBe(true);
            expect(secondRes.body.message).toMatch(/already.*verified/i);

            const profileAfterSecond = await Profile.findOne({ userId: userA._id });
            const expirySecond = new Date(profileAfterSecond.proExpiresAt).getTime();

            // Expiry date must NOT be extended again
            expect(expirySecond).toBe(expiryFirst);
        });
    });

    describe("3. Lifetime VIP Subscription Flow", () => {
        test("Orders and verifies Lifetime VIP Pro (null expiry / permanent)", async () => {
            const orderRes = await request(app)
                .post("/api/v1/payments/create-order")
                .set("Authorization", `Bearer ${tokenB}`)
                .send({ plan: "PRO_LIFETIME" });

            expect(orderRes.statusCode).toBe(201);
            expect(orderRes.body.amount).toBe(249900); // ₹2499
            expect(orderRes.body.plan).toBe("PRO_LIFETIME");

            const lifetimeOrderId = orderRes.body.order_id;
            const lifetimePaymentId = `pay_vip_${crypto.randomBytes(6).toString("hex")}`;
            const validSignature = crypto
                .createHmac("sha256", TEST_KEY_SECRET)
                .update(`${lifetimeOrderId}|${lifetimePaymentId}`)
                .digest("hex");

            const verifyRes = await request(app)
                .post("/api/v1/payments/verify")
                .set("Authorization", `Bearer ${tokenB}`)
                .send({
                    razorpay_order_id: lifetimeOrderId,
                    razorpay_payment_id: lifetimePaymentId,
                    razorpay_signature: validSignature
                });

            expect(verifyRes.statusCode).toBe(200);
            expect(verifyRes.body.profile.isPro).toBe(true);
            expect(verifyRes.body.profile.proPlan).toBe("PRO_LIFETIME");
            expect(verifyRes.body.profile.proExpiresAt).toBeNull(); // Lifetime

            const profileB = await Profile.findOne({ userId: userB._id });
            expect(profileB.isPro).toBe(true);
            expect(profileB.proPlan).toBe("PRO_LIFETIME");
            expect(profileB.proExpiresAt).toBeNull();
        });
    });

    describe("4. Payment History - GET /api/v1/payments/history", () => {
        test("Returns authenticated user's payment records", async () => {
            const res = await request(app)
                .get("/api/v1/payments/history")
                .set("Authorization", `Bearer ${tokenA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.payments)).toBe(true);
            expect(res.body.payments.length).toBeGreaterThan(0);
            expect(res.body.payments[0].user.toString()).toBe(userA._id.toString());
        });
    });
});
