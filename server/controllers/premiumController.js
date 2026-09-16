const crypto = require("crypto");
const Profile = require("../models/Profile");
const Purchase = require("../models/Purchase");
const {
    PRO_PLANS,
    AVATAR_FRAMES,
    PROFILE_THEMES,
    PROFILE_DECORATIONS,
    EMOJI_PACKS,
    COMMUNITY_DECORATIONS,
    findItemById
} = require("../config/storeCatalog");
const { isProfilePro, getUploadLimits } = require("../middleware/premiumMiddleware");

/**
 * Get full store catalog annotated with user's ownership & active status.
 */
const getCatalog = async (req, res) => {
    try {
        const userId = req.user?._id;
        let profile = null;
        let userIsPro = false;
        let userPurchases = [];

        if (userId) {
            profile = await Profile.findOne({ userId });
            userIsPro = isProfilePro(profile);
            userPurchases = await Purchase.find({ user: userId, paymentStatus: "COMPLETED" });
        }

        const ownedItemIds = new Set(userPurchases.map((p) => p.itemId));
        if (profile) {
            (profile.unlockedDecorations || []).forEach((d) => ownedItemIds.add(d));
            (profile.unlockedEmojiPacks || []).forEach((p) => ownedItemIds.add(p));
        }

        const enrichItem = (item) => {
            const isOwned = ownedItemIds.has(item.id) || (userIsPro && item.isProExclusive);
            let isActive = false;

            if (profile) {
                if (item.type === "AVATAR_FRAME") isActive = profile.avatarDecoration === item.id;
                if (item.type === "PROFILE_THEME") isActive = profile.profileTheme === item.id;
                if (item.type === "PROFILE_DECORATION") isActive = profile.profileDecoration === item.id;
            }

            return {
                ...item,
                isOwned,
                isActive,
                isLocked: item.isProExclusive && !userIsPro && !ownedItemIds.has(item.id)
            };
        };

        return res.status(200).json({
            success: true,
            userStatus: {
                isPro: userIsPro,
                plan: profile?.proPlan || "FREE",
                expiresAt: profile?.proExpiresAt || null,
                uploadLimits: getUploadLimits(userIsPro)
            },
            catalog: {
                plans: PRO_PLANS.map((p) => ({
                    ...p,
                    isCurrentPlan: profile?.proPlan === p.planCode && userIsPro
                })),
                avatarFrames: AVATAR_FRAMES.map(enrichItem),
                profileThemes: PROFILE_THEMES.map(enrichItem),
                profileDecorations: PROFILE_DECORATIONS.map(enrichItem),
                emojiPacks: EMOJI_PACKS.map(enrichItem),
                communityDecorations: COMMUNITY_DECORATIONS.map(enrichItem)
            }
        });
    } catch (error) {
        console.error("getCatalog error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get authenticated user's inventory and active customizations.
 */
const getInventory = async (req, res) => {
    try {
        const userId = req.user._id;
        const profile = await Profile.findOne({ userId });
        const userIsPro = isProfilePro(profile);
        const purchases = await Purchase.find({ user: userId, paymentStatus: "COMPLETED" }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            inventory: {
                isPro: userIsPro,
                proPlan: profile?.proPlan || "FREE",
                proExpiresAt: profile?.proExpiresAt || null,
                activeCustomizations: {
                    avatarDecoration: profile?.avatarDecoration || "",
                    profileDecoration: profile?.profileDecoration || "",
                    profileTheme: profile?.profileTheme || "default"
                },
                unlockedDecorations: profile?.unlockedDecorations || [],
                unlockedEmojiPacks: profile?.unlockedEmojiPacks || ["default"],
                purchases
            }
        });
    } catch (error) {
        console.error("getInventory error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Mock Purchase / Unlock Endpoint (simulates payment gateway).
 */
const checkoutMock = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ success: false, message: "Item ID is required" });
        }

        const item = findItemById(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in catalog" });
        }

        let profile = await Profile.findOne({ userId });
        if (!profile) {
            profile = await Profile.create({ userId, username: req.user.username });
        }

        const userIsPro = isProfilePro(profile);

        // Check if item requires active Pro to unlock
        if (item.isProExclusive && !userIsPro && item.type !== "PLAN") {
            return res.status(403).json({
                success: false,
                message: "This item is exclusive to ANOY Pro members. Please upgrade to Pro first.",
                requiresPro: true
            });
        }

        // Generate mock transaction ID
        const transactionId = `mock_txn_${crypto.randomBytes(8).toString("hex")}`;

        // Handle Plan Purchase - PRO plans MUST be purchased through verified Razorpay checkout
        if (item.type === "PLAN") {
            return res.status(400).json({
                success: false,
                message: "Pro plans cannot be purchased via mock checkout. Please use verified Razorpay checkout."
            });
        }

        // Handle Cosmetic Item Unlock
        if (item.type === "EMOJI_PACK") {
            if (!profile.unlockedEmojiPacks.includes(item.id)) {
                profile.unlockedEmojiPacks.push(item.id);
            }
        } else {
            if (!profile.unlockedDecorations.includes(item.id)) {
                profile.unlockedDecorations.push(item.id);
            }
        }
        await profile.save();

        // Record Purchase History
        const purchase = await Purchase.create({
            user: userId,
            itemId: item.id,
            itemType: item.type,
            itemName: item.name,
            pricePaid: item.priceCredits || 0,
            paymentStatus: "COMPLETED",
            provider: "MOCK",
            transactionId
        });

        return res.status(200).json({
            success: true,
            message: `Successfully unlocked ${item.name}!`,
            purchase,
            profile
        });
    } catch (error) {
        console.error("checkoutMock error:", error);
        return res.status(500).json({ success: false, message: "Server error during checkout" });
    }
};

/**
 * Equip an owned customization item.
 */
const activateCustomization = async (req, res) => {
    try {
        const userId = req.user._id;
        const { type, itemId } = req.body;

        if (!type) {
            return res.status(400).json({ success: false, message: "Customization type is required" });
        }

        const profile = await Profile.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        const userIsPro = isProfilePro(profile);

        // Unequip / Reset to default
        if (!itemId || itemId === "none" || itemId === "default") {
            if (type === "AVATAR_FRAME") profile.avatarDecoration = "";
            if (type === "PROFILE_THEME") profile.profileTheme = "default";
            if (type === "PROFILE_DECORATION") profile.profileDecoration = "";
            await profile.save();
            return res.status(200).json({ success: true, message: "Customization removed", profile });
        }

        const item = findItemById(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Customization item not found" });
        }

        // Validate Ownership or Pro Eligibility server-side
        const hasUnlocked = (profile.unlockedDecorations || []).includes(itemId);
        const hasProAccess = item.isProExclusive && userIsPro;

        if (!hasUnlocked && !hasProAccess) {
            return res.status(403).json({
                success: false,
                message: "You must unlock this item or have an active Pro subscription to equip it."
            });
        }

        if (type === "AVATAR_FRAME") profile.avatarDecoration = itemId;
        if (type === "PROFILE_THEME") profile.profileTheme = itemId;
        if (type === "PROFILE_DECORATION") profile.profileDecoration = itemId;

        await profile.save();

        return res.status(200).json({
            success: true,
            message: `Equipped ${item.name}!`,
            profile
        });
    } catch (error) {
        console.error("activateCustomization error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Unequip a customization item.
 */
const deactivateCustomization = async (req, res) => {
    try {
        const userId = req.user._id;
        const { type } = req.body;

        const profile = await Profile.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }

        if (type === "AVATAR_FRAME") profile.avatarDecoration = "";
        if (type === "PROFILE_THEME") profile.profileTheme = "default";
        if (type === "PROFILE_DECORATION") profile.profileDecoration = "";

        await profile.save();

        return res.status(200).json({
            success: true,
            message: "Customization removed",
            profile
        });
    } catch (error) {
        console.error("deactivateCustomization error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get Pro Status and Upload Limits.
 */
const getProStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const profile = await Profile.findOne({ userId });
        const userIsPro = isProfilePro(profile);

        return res.status(200).json({
            success: true,
            isPro: userIsPro,
            proPlan: profile?.proPlan || "FREE",
            proExpiresAt: profile?.proExpiresAt || null,
            uploadLimits: getUploadLimits(userIsPro)
        });
    } catch (error) {
        console.error("getProStatus error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    getCatalog,
    getInventory,
    checkoutMock,
    activateCustomization,
    deactivateCustomization,
    getProStatus
};
