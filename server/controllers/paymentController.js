const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Profile = require("../models/Profile");
const Purchase = require("../models/Purchase");
const { getPlanConfig } = require("../config/storeCatalog");
const { isProfilePro } = require("../middleware/premiumMiddleware");

/**
 * Initializes and returns a Razorpay client instance using environment credentials.
 */
const getRazorpayInstance = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) not configured in environment");
    }

    return new Razorpay({
        key_id,
        key_secret
    });
};

/**
 * Create a new Razorpay Order for ANOY Pro subscription.
 * POST /api/v1/payments/create-order
 */
const createOrder = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { plan, planId } = req.body;
        const requestedPlan = plan || planId;

        if (!requestedPlan) {
            return res.status(400).json({
                success: false,
                message: "Plan identifier is required (e.g. 'PRO_MONTHLY', 'PRO_ANNUAL', 'PRO_LIFETIME')"
            });
        }

        const planConfig = getPlanConfig(requestedPlan);
        if (!planConfig) {
            return res.status(400).json({
                success: false,
                message: `Invalid plan specified: '${requestedPlan}'. Valid plans are PRO_MONTHLY, PRO_ANNUAL, PRO_LIFETIME.`
            });
        }

        // Server-side authoritative price determination (paise)
        const amountPaise = planConfig.pricePaise;
        if (!amountPaise || amountPaise < 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction amount. Must be at least 100 paise (₹1.00)."
            });
        }

        const razorpay = getRazorpayInstance();
        const receipt = `rcpt_${userId.toString().slice(-6)}_${Date.now().toString().slice(-8)}`;

        const options = {
            amount: amountPaise,
            currency: "INR",
            receipt,
            notes: {
                userId: userId.toString(),
                username: req.user.username || "",
                plan: planConfig.planCode,
                planName: planConfig.name
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Record initial payment order in MongoDB
        const payment = await Payment.create({
            user: userId,
            plan: planConfig.planCode,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            status: "created",
            metadata: {
                receipt,
                planName: planConfig.name,
                durationDays: planConfig.durationDays
            }
        });

        return res.status(201).json({
            success: true,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            plan: planConfig.planCode,
            planName: planConfig.name
        });
    } catch (error) {
        console.error("createOrder error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create payment order"
        });
    }
};

/**
 * Verify Razorpay Payment Signature and Entitle ANOY Pro.
 * POST /api/v1/payments/verify
 */
const verifyPayment = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing required verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)"
            });
        }

        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_secret) {
            return res.status(500).json({
                success: false,
                message: "Server payment configuration error"
            });
        }

        // Cryptographic HMAC-SHA256 signature verification
        const expectedSignature = crypto
            .createHmac("sha256", key_secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
        const providedBuffer = Buffer.from(razorpay_signature, "utf-8");

        const isSignatureValid =
            expectedBuffer.length === providedBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, providedBuffer);

        if (!isSignatureValid) {
            // Record failure on payment record if found
            await Payment.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: "failed" }
            );

            return res.status(400).json({
                success: false,
                message: "Invalid payment signature verification failed. Pro entitlement not granted."
            });
        }

        // Locate payment record in database
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment record for this order was not found"
            });
        }

        // Security check: order belongs to authenticated user
        if (payment.user.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: payment order does not belong to current user"
            });
        }

        // Idempotency: If already marked as paid, return success without double extending
        let profile = await Profile.findOne({ userId });
        if (!profile) {
            profile = await Profile.create({ userId, username: req.user.username });
        }

        if (payment.status === "paid") {
            return res.status(200).json({
                success: true,
                message: "Payment has already been verified and processed",
                payment: {
                    id: payment._id,
                    orderId: payment.razorpayOrderId,
                    paymentId: payment.razorpayPaymentId,
                    status: payment.status,
                    plan: payment.plan
                },
                profile: {
                    isPro: isProfilePro(profile),
                    proPlan: profile.proPlan,
                    proExpiresAt: profile.proExpiresAt
                }
            });
        }

        // Mark payment as paid
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = "paid";
        payment.paidAt = new Date();
        await payment.save();

        // Grant Pro entitlement to user profile
        const planConfig = getPlanConfig(payment.plan);
        const durationDays = planConfig ? planConfig.durationDays : 30;

        if (payment.plan === "PRO_LIFETIME") {
            profile.isPro = true;
            profile.proPlan = "PRO_LIFETIME";
            profile.proExpiresAt = null; // Lifetime
        } else {
            const now = new Date();
            const currentExpiry = profile.proExpiresAt ? new Date(profile.proExpiresAt) : null;
            const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
            const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

            profile.isPro = true;
            profile.proPlan = payment.plan;
            profile.proExpiresAt = newExpiry;
        }

        // Grant default Pro emoji packs if not already unlocked
        if (!profile.unlockedEmojiPacks.includes("pack_neon_flair")) {
            profile.unlockedEmojiPacks.push("pack_neon_flair");
        }
        if (!profile.unlockedEmojiPacks.includes("pack_cyber_glow")) {
            profile.unlockedEmojiPacks.push("pack_cyber_glow");
        }

        await profile.save();

        // Record in Purchase history collection for store catalog integration
        await Purchase.findOneAndUpdate(
            { transactionId: razorpay_payment_id },
            {
                user: userId,
                itemId: planConfig ? planConfig.id : "plan_pro_monthly",
                itemType: "PLAN",
                itemName: planConfig ? planConfig.name : "ANOY Pro",
                pricePaid: payment.amount / 100,
                paymentStatus: "COMPLETED",
                provider: "RAZORPAY",
                transactionId: razorpay_payment_id
            },
            { upsert: true, returnDocument: "after" }
        );

        return res.status(200).json({
            success: true,
            message: "Payment verified and ANOY Pro activated successfully! 🎉",
            payment: {
                id: payment._id,
                orderId: payment.razorpayOrderId,
                paymentId: payment.razorpayPaymentId,
                status: payment.status,
                plan: payment.plan,
                amount: payment.amount,
                currency: payment.currency,
                paidAt: payment.paidAt
            },
            profile: {
                isPro: true,
                proPlan: profile.proPlan,
                proExpiresAt: profile.proExpiresAt
            }
        });
    } catch (error) {
        console.error("verifyPayment error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Payment verification failed"
        });
    }
};

/**
 * Handle incoming Razorpay Webhook events (Production architecture).
 * POST /api/v1/payments/webhook
 */
const handleWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            return res.status(400).json({
                success: false,
                message: "RAZORPAY_WEBHOOK_SECRET not configured on server"
            });
        }

        const signature = req.headers["x-razorpay-signature"];
        if (!signature) {
            return res.status(400).json({
                success: false,
                message: "Missing X-Razorpay-Signature header"
            });
        }

        const rawBody = req.rawBody ? req.rawBody.toString("utf-8") : JSON.stringify(req.body);

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
        const providedBuffer = Buffer.from(signature, "utf-8");

        const isSignatureValid =
            expectedBuffer.length === providedBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, providedBuffer);

        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook signature"
            });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === "order.paid" || event === "payment.captured") {
            const paymentEntity = payload.payment?.entity;
            const orderId = paymentEntity?.order_id || payload.order?.entity?.id;

            if (orderId) {
                const payment = await Payment.findOne({ razorpayOrderId: orderId });
                if (payment && payment.status !== "paid") {
                    payment.status = "paid";
                    payment.razorpayPaymentId = paymentEntity?.id || payment.razorpayPaymentId;
                    payment.paidAt = new Date();
                    await payment.save();

                    const planConfig = getPlanConfig(payment.plan);
                    const durationDays = planConfig ? planConfig.durationDays : 30;

                    let profile = await Profile.findOne({ userId: payment.user });
                    if (profile) {
                        if (payment.plan === "PRO_LIFETIME") {
                            profile.isPro = true;
                            profile.proPlan = "PRO_LIFETIME";
                            profile.proExpiresAt = null;
                        } else {
                            const now = new Date();
                            const currentExpiry = profile.proExpiresAt ? new Date(profile.proExpiresAt) : null;
                            const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
                            profile.isPro = true;
                            profile.proPlan = payment.plan;
                            profile.proExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
                        }
                        await profile.save();
                    }
                }
            }
        }

        return res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("handleWebhook error:", error);
        return res.status(500).json({ success: false, message: "Webhook processing error" });
    }
};

/**
 * Get authenticated user's payment history.
 * GET /api/v1/payments/history
 */
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const payments = await Payment.find({ user: userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            payments
        });
    } catch (error) {
        console.error("getPaymentHistory error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching payment history" });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    handleWebhook,
    getPaymentHistory
};
