const express = require("express");

const router = express.Router();

const {
    searchUsers
} = require("../controllers/searchController");


// =====================================================
// SEARCH USERS
// =====================================================

router.get(
    "/users",
    searchUsers
);


module.exports = router;