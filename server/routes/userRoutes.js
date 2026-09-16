const express = require("express");

const router = express.Router();

const {
    searchUsers,
    discoverUsers
} = require("../controllers/userController");


router.get(
    "/search",
    searchUsers
);



router.get(
    "/discover",
    discoverUsers
);


module.exports = router;