const express = require("express");

const router = express.Router();

const {
    searchUsers,
    discoverUsers
} = require("../controllers/userController");


// =====================================================
// USER SEARCH
// =====================================================

router.get(
    "/search",
    searchUsers
);


// =====================================================
// USER DISCOVERY
// =====================================================

router.get(
    "/discover",
    discoverUsers
);


module.exports = router;