require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Identity = require("../models/Identity");
const { hashOTP, compareOTP } = require("../utils/hashUtils");
const generateOTP = require("../utils/generateOTP");

describe("Email OTP Delivery & Security Suite", () => {
    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        // Clean test users
        await Identity.deleteMany({
            email: { $in: ["otptest@test.com", "expired@test.com", "locked@test.com"] }
        });
    }, 30000);

    afterAll(async () => {
        await Identity.deleteMany({
            email: { $in: ["otptest@test.com", "expired@test.com", "locked@test.com"] }
        });
    }, 30000);

    describe("Cryptographic OTP & Hashing Utilities", () => {
        test("generateOTP returns a 6-digit string", () => {
            const otp = generateOTP();
            expect(typeof otp).toBe("string");
            expect(otp).toHaveLength(6);
            expect(/^\d{6}$/.test(otp)).toBe(true);
        });

        test("hashOTP produces deterministic SHA-256 hash", () => {
            const otp = "123456";
            const hash1 = hashOTP(otp);
            const hash2 = hashOTP(otp);
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64);
        });

        test("compareOTP safely validates correct and incorrect candidates", () => {
            const otp = "654321";
            const hash = hashOTP(otp);
            expect(compareOTP("654321", hash)).toBe(true);
            expect(compareOTP("654320", hash)).toBe(false);
            expect(compareOTP("", hash)).toBe(false);
            expect(compareOTP(null, hash)).toBe(false);
        });
    });

    describe("User Registration Flow", () => {
        test("POST /api/v1/auth/register - registers user with hashed OTP (raw OTP not returned or stored plaintext)", async () => {
            const res = await request(app)
                .post("/api/v1/auth/register")
                .send({
                    email: "otptest@test.com",
                    username: "otptestuser",
                    password: "Password123!"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.userId).toBeDefined();
            // Critical Security: OTP MUST NOT be returned in HTTP response
            expect(res.body.otp).toBeUndefined();

            const savedUser = await Identity.findOne({ email: "otptest@test.com" });
            expect(savedUser).toBeDefined();
            expect(savedUser.emailVerified).toBe(false);
            expect(savedUser.status).toBe("PENDING");
            expect(savedUser.verificationOTPHash).toBeDefined();
            expect(savedUser.verificationOTPHash).toHaveLength(64);
            expect(savedUser.verificationOTPExpiry).toBeDefined();
            expect(savedUser.verificationAttempts).toBe(0);
        });

        test("POST /api/v1/auth/login - blocks login for unverified account", async () => {
            const res = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: "otptest@test.com",
                    password: "Password123!"
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/verify your email/i);
        });
    });

    describe("OTP Verification Security & Attempt Rate-Limiting", () => {
        test("POST /api/v1/auth/verify-email - wrong OTP increments attempts and returns remaining count", async () => {
            const res = await request(app)
                .post("/api/v1/auth/verify-email")
                .send({
                    email: "otptest@test.com",
                    otp: "000000"
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/4 attempts? remaining/i);

            const user = await Identity.findOne({ email: "otptest@test.com" });
            expect(user.verificationAttempts).toBe(1);
        });

        test("POST /api/v1/auth/verify-email - locks and invalidates OTP after 5 failed attempts", async () => {
            // Send 4 more failed attempts (total 5)
            await request(app).post("/api/v1/auth/verify-email").send({ email: "otptest@test.com", otp: "000001" });
            await request(app).post("/api/v1/auth/verify-email").send({ email: "otptest@test.com", otp: "000002" });
            await request(app).post("/api/v1/auth/verify-email").send({ email: "otptest@test.com", otp: "000003" });
            
            const res5 = await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: "otptest@test.com", otp: "000004" });

            expect(res5.statusCode).toBe(429);
            expect(res5.body.success).toBe(false);
            expect(res5.body.message).toMatch(/maximum verification attempts exceeded/i);

            const lockedUser = await Identity.findOne({ email: "otptest@test.com" });
            expect(lockedUser.verificationOTPHash).toBeUndefined();
            expect(lockedUser.verificationOTPExpiry).toBeUndefined();
        });
    });

    describe("Expired OTP Handling", () => {
        test("POST /api/v1/auth/verify-email - rejects expired OTP", async () => {
            const knownOtp = "777888";
            await Identity.create({
                email: "expired@test.com",
                username: "expireduser",
                passwordHash: "dummyhash",
                emailVerified: false,
                status: "PENDING",
                verificationOTPHash: hashOTP(knownOtp),
                verificationOTPExpiry: new Date(Date.now() - 1000 * 60) // 1 minute in the past
            });

            const res = await request(app)
                .post("/api/v1/auth/verify-email")
                .send({
                    email: "expired@test.com",
                    otp: knownOtp
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/expired/i);
        });
    });

    describe("Resend OTP & Cooldown Rate-Limiting", () => {
        test("POST /api/v1/auth/resend-otp - enforces 60-second cooldown", async () => {
            // Set lastOTPResentAt to 10 seconds ago
            await Identity.updateOne(
                { email: "otptest@test.com" },
                { $set: { lastOTPResentAt: new Date(Date.now() - 10 * 1000) } }
            );

            const res = await request(app)
                .post("/api/v1/auth/resend-otp")
                .send({ email: "otptest@test.com" });

            expect(res.statusCode).toBe(429);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/wait/i);
            expect(res.body.retryAfter).toBeGreaterThan(0);
        });

        test("POST /api/v1/auth/resend-otp - generates new OTP and resets attempts after cooldown", async () => {
            // Simulate cooldown elapsed (> 60 seconds ago)
            await Identity.updateOne(
                { email: "otptest@test.com" },
                { $set: { lastOTPResentAt: new Date(Date.now() - 65 * 1000) } }
            );

            const res = await request(app)
                .post("/api/v1/auth/resend-otp")
                .send({ email: "otptest@test.com" });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.otp).toBeUndefined(); // Never exposed

            const user = await Identity.findOne({ email: "otptest@test.com" });
            expect(user.verificationOTPHash).toBeDefined();
            expect(user.verificationAttempts).toBe(0);
            expect(user.verificationOTPExpiry.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe("Successful Verification & Login Activation", () => {
        test("POST /api/v1/auth/verify-email - verifies account with valid OTP and enables login", async () => {
            // Set a test OTP
            const testOtp = "889900";
            await Identity.updateOne(
                { email: "otptest@test.com" },
                {
                    $set: {
                        verificationOTPHash: hashOTP(testOtp),
                        verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000),
                        verificationAttempts: 0
                    }
                }
            );

            const verifyRes = await request(app)
                .post("/api/v1/auth/verify-email")
                .send({
                    email: "otptest@test.com",
                    otp: testOtp
                });

            expect(verifyRes.statusCode).toBe(200);
            expect(verifyRes.body.success).toBe(true);

            // Verify DB state
            const verifiedUser = await Identity.findOne({ email: "otptest@test.com" });
            expect(verifiedUser.emailVerified).toBe(true);
            expect(verifiedUser.status).toBe("ACTIVE");
            expect(verifiedUser.verificationOTPHash).toBeUndefined();
            expect(verifiedUser.verificationOTPExpiry).toBeUndefined();

            // Now login should succeed
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: "otptest@test.com",
                    password: "Password123!"
                });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);
            expect(loginRes.body.token).toBeDefined();
            expect(loginRes.body.user.username).toBe("otptestuser");
        });

        test("POST /api/v1/auth/verify-email & resend-otp reject already verified accounts", async () => {
            const verifyAgain = await request(app)
                .post("/api/v1/auth/verify-email")
                .send({
                    email: "otptest@test.com",
                    otp: "123456"
                });
            expect(verifyAgain.statusCode).toBe(400);
            expect(verifyAgain.body.message).toMatch(/already verified/i);

            const resendAgain = await request(app)
                .post("/api/v1/auth/resend-otp")
                .send({
                    email: "otptest@test.com"
                });
            expect(resendAgain.statusCode).toBe(400);
            expect(resendAgain.body.message).toMatch(/already verified/i);
        });
    });

    describe("Password Reset OTP Delivery, Verification & Brute-Force Security Suite", () => {
        const resetEmail = "resettest@test.com";
        const resetUsername = "resetuser";
        const initialPassword = "OldPassword123!";
        const newPassword = "NewPassword123!";

        beforeAll(async () => {
            const bcrypt = require("bcryptjs");
            const passwordHash = await bcrypt.hash(initialPassword, 10);
            await Identity.deleteMany({
                email: { $in: [resetEmail, "resetexp@test.com", "resetlock@test.com"] }
            });
            await Identity.create({
                email: resetEmail,
                username: resetUsername,
                passwordHash,
                loginProvider: "email",
                emailVerified: true,
                status: "ACTIVE"
            });
        });

        test("POST /api/v1/auth/forgot-password - dispatches OTP and prevents user enumeration", async () => {
            // Test existing user
            const res = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: resetEmail });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.otp).toBeUndefined(); // Never expose raw OTP in response

            const user = await Identity.findOne({ email: resetEmail });
            expect(user.passwordResetOTP).toBeDefined();
            expect(user.passwordResetOTP).toHaveLength(64); // SHA-256 hash
            expect(user.passwordResetExpiry).toBeDefined();
            expect(user.passwordResetAttempts).toBe(0);

            // Test non-existent email gives identical success response (anti-enumeration)
            const nonExistentRes = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: "doesnotexist_99@test.com" });

            expect(nonExistentRes.statusCode).toBe(200);
            expect(nonExistentRes.body.success).toBe(true);
            expect(nonExistentRes.body.message).toMatch(/If an account with this email exists/i);
        });

        test("POST /api/v1/auth/forgot-password - excessive OTP requests are rate-limited", async () => {
            const res = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: resetEmail });

            expect(res.statusCode).toBe(429);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/wait/i);
            expect(res.body.retryAfter).toBeGreaterThan(0);
        });

        test("POST /api/v1/auth/reset-password - wrong OTP increments failed attempts and returns remaining count", async () => {
            const res = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: resetEmail,
                    otp: "000000",
                    newPassword
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/4 attempts? remaining/i);

            const user = await Identity.findOne({ email: resetEmail });
            expect(user.passwordResetAttempts).toBe(1);
        });

        test("POST /api/v1/auth/reset-password - maximum failed attempts invalidates the OTP and rate-limits", async () => {
            // Send 3 more failed attempts (total 4)
            await request(app).post("/api/v1/auth/reset-password").send({ email: resetEmail, otp: "000001", newPassword });
            await request(app).post("/api/v1/auth/reset-password").send({ email: resetEmail, otp: "000002", newPassword });
            await request(app).post("/api/v1/auth/reset-password").send({ email: resetEmail, otp: "000003", newPassword });

            // 5th failed attempt locks out
            const res5 = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ email: resetEmail, otp: "000004", newPassword });

            expect(res5.statusCode).toBe(429);
            expect(res5.body.success).toBe(false);
            expect(res5.body.message).toMatch(/maximum password reset attempts exceeded/i);

            // Verify that the OTP is completely cleared/invalidated in DB
            const lockedUser = await Identity.findOne({ email: resetEmail });
            expect(lockedUser.passwordResetOTP).toBeUndefined();
            expect(lockedUser.passwordResetExpiry).toBeUndefined();

            // Subsequent attempts fail because OTP no longer exists
            const subsequentRes = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ email: resetEmail, otp: "123456", newPassword });

            expect(subsequentRes.statusCode).toBe(400);
            expect(subsequentRes.body.message).toMatch(/no active password reset request found/i);
        });

        test("POST /api/v1/auth/reset-password - expired OTP fails and is cleared", async () => {
            const knownOtp = "123987";
            await Identity.create({
                email: "resetexp@test.com",
                username: "resetexpuser",
                passwordHash: "dummyhash",
                emailVerified: true,
                status: "ACTIVE",
                passwordResetOTP: hashOTP(knownOtp),
                passwordResetExpiry: new Date(Date.now() - 60 * 1000) // 1 minute in past
            });

            const res = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: "resetexp@test.com",
                    otp: knownOtp,
                    newPassword
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/expired/i);

            const user = await Identity.findOne({ email: "resetexp@test.com" });
            expect(user.passwordResetOTP).toBeUndefined();
        });

        test("POST /api/v1/auth/reset-password - correct OTP succeeds, resets password, and cannot be reused", async () => {
            const validOtp = "554433";
            await Identity.updateOne(
                { email: resetEmail },
                {
                    $set: {
                        passwordResetOTP: hashOTP(validOtp),
                        passwordResetExpiry: new Date(Date.now() + 10 * 60 * 1000),
                        passwordResetAttempts: 0
                    }
                }
            );

            // Successful reset
            const resetRes = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: resetEmail,
                    otp: validOtp,
                    newPassword
                });

            expect(resetRes.statusCode).toBe(200);
            expect(resetRes.body.success).toBe(true);
            expect(resetRes.body.message).toMatch(/password reset successfully/i);

            // Verify OTP is cleared in DB
            const user = await Identity.findOne({ email: resetEmail });
            expect(user.passwordResetOTP).toBeUndefined();
            expect(user.passwordResetExpiry).toBeUndefined();

            // OTP cannot be reused
            const reuseRes = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: resetEmail,
                    otp: validOtp,
                    newPassword: "AnotherPassword123!"
                });

            expect(reuseRes.statusCode).toBe(400);
            expect(reuseRes.body.message).toMatch(/no active password reset request found/i);

            // Normal login with new password succeeds
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: resetEmail,
                    password: newPassword
                });

            expect(loginRes.statusCode).toBe(200);
            expect(loginRes.body.success).toBe(true);
            expect(loginRes.body.token).toBeDefined();

            // Login with old password fails
            const oldLoginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    identifier: resetEmail,
                    password: initialPassword
                });

            expect(oldLoginRes.statusCode).toBe(401);
        });

        test("POST /api/v1/auth/reset-password - concurrent failed attempts cannot race or bypass the 5-attempt limit", async () => {
            const raceEmail = "race@test.com";
            const knownOtp = "998877";
            const bcrypt = require("bcryptjs");
            const passwordHash = await bcrypt.hash("InitialPass123!", 10);

            await Identity.deleteMany({ email: raceEmail });
            await Identity.create({
                email: raceEmail,
                username: "raceuser",
                passwordHash,
                loginProvider: "email",
                emailVerified: true,
                status: "ACTIVE",
                passwordResetOTP: hashOTP(knownOtp),
                passwordResetExpiry: new Date(Date.now() + 10 * 60 * 1000),
                passwordResetAttempts: 0
            });

            // Fire 10 concurrent requests with wrong OTP
            const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
                request(app)
                    .post("/api/v1/auth/reset-password")
                    .send({
                        email: raceEmail,
                        otp: `00000${i}`,
                        newPassword: "BrandNewPass123!"
                    })
            );

            const responses = await Promise.all(concurrentRequests);

            // At least one request must receive 429 lock status
            const status429Count = responses.filter((r) => r.statusCode === 429).length;
            expect(status429Count).toBeGreaterThanOrEqual(1);

            // Verify in DB that the OTP is completely invalidated/cleared
            const lockedUser = await Identity.findOne({ email: raceEmail });
            expect(lockedUser.passwordResetOTP).toBeUndefined();
            expect(lockedUser.passwordResetExpiry).toBeUndefined();

            // Correct OTP now fails because the limit was reached and OTP was destroyed
            const res = await request(app)
                .post("/api/v1/auth/reset-password")
                .send({
                    email: raceEmail,
                    otp: knownOtp,
                    newPassword: "BrandNewPass123!"
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/no active password reset request found/i);

            await Identity.deleteMany({ email: raceEmail });
        });
    });
});
