const express = require("express");

const router = express.Router();


const {

createProfile,
getProfile,
updateProfile

} = require("../controllers/profileController");



// Create profile

router.post(
"/create",
createProfile
);


// Get profile

router.get(
"/:username",
getProfile
);


// Update profile

router.put(
"/:username",
updateProfile
);



module.exports = router;