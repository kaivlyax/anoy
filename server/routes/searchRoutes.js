const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    searchUsers,
    searchCommunities,
    searchPosts,
    unifiedSearch
} = require("../controllers/searchController");

// Unified search
router.get("/", protect, unifiedSearch);

// Category search routes
router.get("/users", protect, searchUsers);
router.get("/communities", protect, searchCommunities);
router.get("/posts", protect, searchPosts);

module.exports = router;