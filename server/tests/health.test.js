const request = require("supertest");

const app = require("../app");

describe("Health Check", () => {

    test("GET / should return 200", async () => {

        const response =
            await request(app)
                .get("/");

        expect(response.statusCode)
            .toBe(200);

        expect(response.body.success)
            .toBe(true);

        expect(response.body.message)
            .toBe(
                "Welcome to ANOY Backend API 🚀"
            );

    });

});