require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5001;

// Connect to MongoDB
connectDB();

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

server.listen(PORT, () => {
    console.log(`🚀 ANOY Server with Real-Time Socket.IO running on port ${PORT}`);
});