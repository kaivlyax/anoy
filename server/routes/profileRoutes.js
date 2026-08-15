const express = require("express");

const router = express.Router();

const {
    createProfile,
    getMyProfile,
    getProfile,
    updateMyProfile,
    updateProfile
} = require("../controllers/profileController");

const protect = require("../middleware/authMiddleware");


// =====================================================
// AUTHENTICATED USER
// =====================================================

router.get(
    "/me",
    protect,
    getMyProfile
);


router.put(
    "/me",
    protect,
    updateMyProfile
);


// =====================================================
// PROFILE CREATION
// =====================================================

router.post(
    "/",
    protect,
    createProfile
);


// =====================================================
// PUBLIC PROFILE
// =====================================================

router.get(
    "/:username",
    getProfile
);


// =====================================================
// LEGACY USERNAME-BASED UPDATE
// =====================================================

router.put(
    "/:username",
    protect,
    updateProfile
);


module.exports = router;