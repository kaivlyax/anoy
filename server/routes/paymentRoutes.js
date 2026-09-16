const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    createOrder,
    verifyPayment,
    handleWebhook,
    getPaymentHistory
} = require("../controllers/paymentController");

// Authenticated Payment Actions
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.get("/history", protect, getPaymentHistory);

// Webhook for Razorpay asynchronous events (signature verified internally)
router.post("/webhook", handleWebhook);

module.exports = router;
