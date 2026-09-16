require("dotenv").config();
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Identity = require("../models/Identity");
const Profile = require("../models/Profile");
const StudyRoom = require("../models/StudyRoom");

describe("Study Rooms Collaborative Video System Suite", () => {
    let studentA, studentB;
    let tokenA, tokenB;
    let createdRoomId;

    beforeAll(async () => {
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy");
        }

        await Identity.deleteMany({ email: { $in: ["student_a@test.com", "student_b@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["student_a", "student_b"] } });
        await StudyRoom.deleteMany({ title: "Algorithms Final Exam Prep" });

        studentA = await Identity.create({
            email: "student_a@test.com",
            username: "student_a",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: studentA._id, username: "student_a", displayName: "Student A" });

        studentB = await Identity.create({
            email: "student_b@test.com",
            username: "student_b",
            passwordHash: "h",
            emailVerified: true,
            status: "ACTIVE"
        });
        await Profile.create({ userId: studentB._id, username: "student_b", displayName: "Student B" });

        tokenA = jwt.sign({ userId: studentA._id, username: studentA.username }, process.env.JWT_SECRET);
        tokenB = jwt.sign({ userId: studentB._id, username: studentB.username }, process.env.JWT_SECRET);
    });

    afterAll(async () => {
        await Identity.deleteMany({ email: { $in: ["student_a@test.com", "student_b@test.com"] } });
        await Profile.deleteMany({ username: { $in: ["student_a", "student_b"] } });
        await StudyRoom.deleteMany({ title: "Algorithms Final Exam Prep" });
        await mongoose.connection.close();
    });

    it("POST /api/v1/study-rooms - Student A creates a study room", async () => {
        const res = await request(app)
            .post("/api/v1/study-rooms")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({
                title: "Algorithms Final Exam Prep",
                description: "Reviewing dynamic programming and graph algorithms",
                topic: "Computer Science",
                isPrivate: true,
                passcode: "cs2026",
                maxParticipants: 6
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.room.title).toBe("Algorithms Final Exam Prep");
        createdRoomId = res.body.room._id;
    });

    it("GET /api/v1/study-rooms - should list active study rooms without exposing passcodes", async () => {
        const res = await request(app)
            .get("/api/v1/study-rooms")
            .set("Authorization", `Bearer ${tokenB}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.rooms.length).toBeGreaterThanOrEqual(1);
        const room = res.body.rooms.find((r) => r._id.toString() === createdRoomId.toString());
        expect(room).toBeDefined();
        expect(room.hasPasscode).toBe(true);
        expect(room.passcode).toBeUndefined();
    });

    it("POST /api/v1/study-rooms/:id/join - Student B cannot join private room with wrong passcode", async () => {
        const res = await request(app)
            .post(`/api/v1/study-rooms/${createdRoomId}/join`)
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ passcode: "wrongpass" });

        expect(res.statusCode).toBe(401);
    });

    it("POST /api/v1/study-rooms/:id/join - Student B joins with correct passcode", async () => {
        const res = await request(app)
            .post(`/api/v1/study-rooms/${createdRoomId}/join`)
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ passcode: "cs2026" });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("POST /api/v1/study-rooms/:id/leave - Student B leaves room", async () => {
        const res = await request(app)
            .post(`/api/v1/study-rooms/${createdRoomId}/leave`)
            .set("Authorization", `Bearer ${tokenB}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
