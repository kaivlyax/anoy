process.env.MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anoy_test";
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "ff2add0f28c6c8da2aaf72cc2a9728f3bb0f2876eba5a3379946a1b8fd7717ef0bf6fa58872dfd2bc89e78211257d09a58e3206fe73abd93aff7325fac3b7f46";
}

const mongoose = require("mongoose");

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});
