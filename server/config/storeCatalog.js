/**
 * ANOY Premium Store Catalog & Item Registry
 * Defines all available Pro plans, Avatar Frames, Profile Themes,
 * Profile Decorations, Emoji Packs, and Community Decorations.
 */

const PRO_PLANS = [
    {
        id: "plan_pro_monthly",
        type: "PLAN",
        name: "ANOY Pro (Monthly)",
        description: "Unlock all Pro badges, avatar frames, custom themes, premium reactions, 25MB HD uploads, and community boosting.",
        durationDays: 30,
        planCode: "PRO_MONTHLY",
        priceCredits: 500,
        priceINR: 99,
        pricePaise: 9900,
        badge: "Popular",
        features: [
            "Pro profile badge & glow",
            "Access to all premium avatar frames",
            "Exclusive neon & royal profile themes",
            "Premium animated reaction packs",
            "25MB HD upload limit (vs 5MB)",
            "Ability to boost communities"
        ]
    },
    {
        id: "plan_pro_annual",
        type: "PLAN",
        name: "ANOY Pro (Annual)",
        description: "Save 30% with an annual Pro subscription. Full access to every Pro perk.",
        durationDays: 365,
        planCode: "PRO_ANNUAL",
        priceCredits: 4200,
        priceINR: 799,
        pricePaise: 79900,
        badge: "Best Value",
        features: [
            "Everything in Pro Monthly",
            "2 Months Free (Save 33%)",
            "Exclusive 'Gold Royale' theme",
            "Priority community boosting badge"
        ]
    },
    {
        id: "plan_pro_lifetime",
        type: "PLAN",
        name: "ANOY Pro (Lifetime VIP)",
        description: "One-time unlock for permanent Pro status and all future VIP features.",
        durationDays: 36500, // 100 years
        planCode: "PRO_LIFETIME",
        priceCredits: 12000,
        priceINR: 2499,
        pricePaise: 249900,
        badge: "VIP",
        features: [
            "Permanent Pro status forever",
            "VIP profile border & insignia",
            "All current and future store items unlocked",
            "Unlimited community boosts"
        ]
    }
];

const AVATAR_FRAMES = [
    {
        id: "frame_neon_glow",
        type: "AVATAR_FRAME",
        name: "Neon Cyber Pulse",
        description: "Electric cyan and purple pulsating aura frame.",
        cssClass: "frame-neon-glow",
        isProExclusive: true,
        priceCredits: 100
    },
    {
        id: "frame_gold_royale",
        type: "AVATAR_FRAME",
        name: "Gold Royale Laurel",
        description: "Gleaming 24K gold border with subtle particle shimmer.",
        cssClass: "frame-gold-royale",
        isProExclusive: true,
        priceCredits: 150
    },
    {
        id: "frame_cyber_matrix",
        type: "AVATAR_FRAME",
        name: "Matrix Glitch",
        description: "Cybernetic animated scanline frame with emerald accents.",
        cssClass: "frame-cyber-matrix",
        isProExclusive: true,
        priceCredits: 120
    },
    {
        id: "frame_aurora_emerald",
        type: "AVATAR_FRAME",
        name: "Northern Aurora",
        description: "Luminescent green and turquoise celestial gradient frame.",
        cssClass: "frame-aurora-emerald",
        isProExclusive: false,
        priceCredits: 80
    },
    {
        id: "frame_cosmic_flame",
        type: "AVATAR_FRAME",
        name: "Cosmic Flame",
        description: "Vibrant solar flare ring with animated radial burn.",
        cssClass: "frame-cosmic-flame",
        isProExclusive: true,
        priceCredits: 180
    }
];

const PROFILE_THEMES = [
    {
        id: "theme_neon_cyber",
        type: "PROFILE_THEME",
        name: "Neon Cyberpunk",
        description: "Deep obsidian backdrop with neon violet and electric indigo gradients.",
        themeClass: "theme-neon-cyber",
        isProExclusive: true,
        priceCredits: 150
    },
    {
        id: "theme_gold_royale",
        type: "PROFILE_THEME",
        name: "Imperial Gold",
        description: "Opulent champagne and warm amber gradient styling.",
        themeClass: "theme-gold-royale",
        isProExclusive: true,
        priceCredits: 200
    },
    {
        id: "theme_midnight_galaxy",
        type: "PROFILE_THEME",
        name: "Midnight Galaxy",
        description: "Deep space theme with starlight nebulae and soft cyan accents.",
        themeClass: "theme-midnight-galaxy",
        isProExclusive: false,
        priceCredits: 100
    },
    {
        id: "theme_emerald_aurora",
        type: "PROFILE_THEME",
        name: "Emerald Aurora",
        description: "Lush botanical and emerald iridescent glass accents.",
        themeClass: "theme-emerald-aurora",
        isProExclusive: true,
        priceCredits: 120
    }
];

const PROFILE_DECORATIONS = [
    {
        id: "deco_hologram_grid",
        type: "PROFILE_DECORATION",
        name: "Holographic Banner Grid",
        description: "Futuristic isometric grid overlay on profile banner.",
        cssClass: "deco-hologram-grid",
        isProExclusive: true,
        priceCredits: 100
    },
    {
        id: "deco_star_constellation",
        type: "PROFILE_DECORATION",
        name: "Star Constellation",
        description: "Twinkling star cluster animation across profile header.",
        cssClass: "deco-star-constellation",
        isProExclusive: false,
        priceCredits: 80
    },
    {
        id: "deco_golden_laurel",
        type: "PROFILE_DECORATION",
        name: "Golden Crest",
        description: "Prestigious insignia emblem displayed beside user handle.",
        cssClass: "deco-golden-laurel",
        isProExclusive: true,
        priceCredits: 150
    }
];

const EMOJI_PACKS = [
    {
        id: "pack_default",
        type: "EMOJI_PACK",
        name: "Classic Expressions",
        description: "Standard set of emojis available to all ANOY users.",
        isProExclusive: false,
        priceCredits: 0,
        emojis: ["👍", "❤️", "🔥", "😂", "🎉", "🚀"]
    },
    {
        id: "pack_neon_flair",
        type: "EMOJI_PACK",
        name: "Neon Glow Reactions",
        description: "Glowing cyberpunk emoji set with electric styling.",
        isProExclusive: true,
        priceCredits: 100,
        emojis: ["⚡", "💎", "👾", "✨", "🛸", "🔮", "👑", "🌈"]
    },
    {
        id: "pack_cyber_glow",
        type: "EMOJI_PACK",
        name: "Cyber & Tech Vibe",
        description: "Developer and creator expressions with dynamic highlights.",
        isProExclusive: true,
        priceCredits: 120,
        emojis: ["💻", "🧠", "🤖", "🧬", "🌌", "⚡", "🛰️", "🧪"]
    },
    {
        id: "pack_gold_vip",
        type: "EMOJI_PACK",
        name: "Royale VIP Expressions",
        description: "Luxury gold badges and prestige reaction reactions.",
        isProExclusive: true,
        priceCredits: 200,
        emojis: ["🏆", "👑", "💰", "🥂", "⚜️", "🌟", "🛡️", "🔥"]
    }
];

const COMMUNITY_DECORATIONS = [
    {
        id: "comm_frame_shield",
        type: "COMMUNITY_DECORATION",
        name: "Guardian Aegis Shield Frame",
        description: "Golden protective shield frame around community icon.",
        category: "iconFrame",
        cssClass: "comm-frame-shield",
        priceCredits: 250
    },
    {
        id: "comm_banner_cyber",
        type: "COMMUNITY_DECORATION",
        name: "Cyber City Banner Overlay",
        description: "Animated cyber skyline banner pattern.",
        category: "bannerTheme",
        cssClass: "comm-banner-cyber",
        priceCredits: 300
    },
    {
        id: "comm_theme_royal",
        type: "COMMUNITY_DECORATION",
        name: "Royal Purple Community Theme",
        description: "Deep violet headers and highlighted member badges.",
        category: "theme",
        cssClass: "comm-theme-royal",
        priceCredits: 200
    }
];

const ALL_ITEMS = [
    ...PRO_PLANS,
    ...AVATAR_FRAMES,
    ...PROFILE_THEMES,
    ...PROFILE_DECORATIONS,
    ...EMOJI_PACKS,
    ...COMMUNITY_DECORATIONS
];

const findItemById = (itemId) => {
    return ALL_ITEMS.find((item) => item.id === itemId) || null;
};

const getPlanConfig = (identifier) => {
    if (!identifier) return null;
    const normalized = String(identifier).trim().toUpperCase();
    if (normalized === "MONTHLY" || normalized === "PRO_MONTHLY" || normalized === "PLAN_PRO_MONTHLY") {
        return PRO_PLANS.find((p) => p.planCode === "PRO_MONTHLY");
    }
    if (normalized === "ANNUAL" || normalized === "PRO_ANNUAL" || normalized === "PLAN_PRO_ANNUAL" || normalized === "YEARLY") {
        return PRO_PLANS.find((p) => p.planCode === "PRO_ANNUAL");
    }
    if (normalized === "LIFETIME" || normalized === "PRO_LIFETIME" || normalized === "PLAN_PRO_LIFETIME" || normalized === "VIP") {
        return PRO_PLANS.find((p) => p.planCode === "PRO_LIFETIME");
    }
    return PRO_PLANS.find((p) => p.id === identifier || p.planCode === identifier) || null;
};

module.exports = {
    PRO_PLANS,
    AVATAR_FRAMES,
    PROFILE_THEMES,
    PROFILE_DECORATIONS,
    EMOJI_PACKS,
    COMMUNITY_DECORATIONS,
    ALL_ITEMS,
    findItemById,
    getPlanConfig
};

