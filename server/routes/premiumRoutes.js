const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    getCatalog,
    getInventory,
    checkoutMock,
    activateCustomization,
    deactivateCustomization,
    getProStatus
} = require("../controllers/premiumController");

// Public/Semi-public catalog
router.get("/catalog", protect, getCatalog);
router.get("/status", protect, getProStatus);
router.get("/inventory", protect, getInventory);

// Purchase & Customization
router.post("/checkout-mock", protect, checkoutMock);
router.post("/activate", protect, activateCustomization);
router.post("/deactivate", protect, deactivateCustomization);

module.exports = router;
