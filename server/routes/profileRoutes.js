const express = require("express");

const router = express.Router();

const {

    createProfile,
    getMyProfile,
    getProfile,
    updateMyProfile,
    updateProfile,
    getProfileStats

} = require("../controllers/profileController");

const protect = require("../middleware/authMiddleware");


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



router.post(
    "/",
    protect,
    createProfile
);


router.get(
    "/:username/stats",
    getProfileStats
);


router.get(
    "/:username",
    getProfile
);


router.put(
    "/:username",
    protect,
    updateProfile
);


module.exports = router;