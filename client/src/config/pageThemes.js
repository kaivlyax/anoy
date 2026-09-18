/**
 * pageThemes.js
 * Configuration for Indian Landmark and Atmospheric Themes per route.
 * Each theme provides:
 * - id: unique key
 * - name: English & Cultural title
 * - landmark: Landmark / Cultural motif represented
 * - location: Location in India
 * - skyGradient: Multi-stop CSS gradient for the atmosphere
 * - ambientColor: Primary glow tint for borders and glass reflections
 * - accentGlow: Secondary accent glow
 * - svgScene: Dynamic SVG vector silhouette & architectural backdrop
 */

export const PAGE_THEMES = {
  // 1. HOME / DASHBOARD: Taj Mahal Twilight & Reflecting Pool
  home: {
    id: "home",
    name: "Taj Mahal Twilight",
    landmark: "Taj Mahal, Agra",
    location: "Uttar Pradesh",
    quote: "Ideas from India. For a brighter tomorrow.",
    skyGradient: "linear-gradient(180deg, #090d16 0%, #15102a 35%, #2a1636 65%, #3d1c28 85%, #180d19 100%)",
    ambientColor: "rgba(255, 153, 51, 0.12)",
    accentGlow: "rgba(236, 72, 153, 0.15)",
    bannerBadge: "🇮🇳 Built for Bharat",
    bannerTitle: "Taj Mahal Sunset",
    bannerSubtitle: "Agra, Uttar Pradesh",
    svgType: "taj-mahal"
  },

  // 2. EXPLORE: Jaipur Hawa Mahal & Amber Fort Desert Sunset
  explore: {
    id: "explore",
    name: "Jaipur Amber Dusk",
    landmark: "Hawa Mahal & Amber Fort, Jaipur",
    location: "Rajasthan",
    quote: "Discover stories, art, and voices echoing across the vibrant subcontinent.",
    skyGradient: "linear-gradient(180deg, #0d0b18 0%, #201328 35%, #3e1b24 70%, #4a2118 90%, #1a0f0d 100%)",
    ambientColor: "rgba(249, 115, 22, 0.14)",
    accentGlow: "rgba(245, 158, 11, 0.18)",
    bannerBadge: "🏰 Royal Heritage",
    bannerTitle: "Jaipur Palace Dusk",
    bannerSubtitle: "Jaipur, Rajasthan",
    svgType: "jaipur"
  },

  // 3. SEARCH: India Gate & Rajpath Monumental Arches
  search: {
    id: "search",
    name: "India Gate Aurora",
    landmark: "India Gate, New Delhi",
    location: "National Capital Region",
    quote: "Search across millions of student perspectives, communities, and innovations.",
    skyGradient: "linear-gradient(180deg, #080e1a 0%, #0d1b30 40%, #122842 75%, #1f293d 90%, #0c111c 100%)",
    ambientColor: "rgba(56, 189, 248, 0.14)",
    accentGlow: "rgba(99, 102, 241, 0.16)",
    bannerBadge: "🏛️ National Landmark",
    bannerTitle: "India Gate Vista",
    bannerSubtitle: "New Delhi",
    svgType: "india-gate"
  },

  // 4. COMMUNITIES: University Heritage Campus Courtyard
  communities: {
    id: "communities",
    name: "Campus Courtyard & Banyan Canopy",
    landmark: "Nalanda & IIT Heritage Archways",
    location: "Knowledge Hubs of Bharat",
    quote: "Gather in campus circles, clubs, and collaborative student spaces.",
    skyGradient: "linear-gradient(180deg, #0a1118 0%, #0d2024 35%, #132e2c 70%, #1e3b32 90%, #0b1714 100%)",
    ambientColor: "rgba(16, 185, 129, 0.14)",
    accentGlow: "rgba(52, 211, 153, 0.16)",
    bannerBadge: "🎓 Campus Circles",
    bannerTitle: "University Courtyard",
    bannerSubtitle: "Student Knowledge Hubs",
    svgType: "campus"
  },

  // 5. MESSAGES: Mumbai Cyber-Skyline & Sea Link Reflections
  messages: {
    id: "messages",
    name: "Bandra Sea Link Cyber Metropolis",
    landmark: "Sea Link & Mumbai Skyline",
    location: "Maharashtra",
    quote: "Real-time encrypted conversations connecting students across timezones.",
    skyGradient: "linear-gradient(180deg, #070913 0%, #0c1429 40%, #11203d 75%, #0f2c42 90%, #071018 100%)",
    ambientColor: "rgba(14, 165, 233, 0.14)",
    accentGlow: "rgba(99, 102, 241, 0.16)",
    bannerBadge: "🌉 Metropolis Nocturne",
    bannerTitle: "Bandra Sea Link",
    bannerSubtitle: "Mumbai, Maharashtra",
    svgType: "sea-link"
  },

  // 6. NOTIFICATIONS: Konark Sun Temple & Mandala Starlight
  notifications: {
    id: "notifications",
    name: "Konark Starlight Mandalas",
    landmark: "Konark Sun Temple & Celestial Wheels",
    location: "Odisha",
    quote: "Stay in rhythm with likes, mentions, follow requests, and university updates.",
    skyGradient: "linear-gradient(180deg, #0c0a18 0%, #19122e 40%, #29183e 75%, #351c42 90%, #110b1a 100%)",
    ambientColor: "rgba(168, 85, 247, 0.14)",
    accentGlow: "rgba(236, 72, 153, 0.16)",
    bannerBadge: "🪷 Celestial Heritage",
    bannerTitle: "Konark Starlight",
    bannerSubtitle: "Puri, Odisha",
    svgType: "konark"
  },

  // 7. ANOY AI: ISRO Cyber-Constellation & Aryabhata Nebula
  ai: {
    id: "ai",
    name: "ISRO Space Nebula & Aryabhata Orbits",
    landmark: "Satish Dhawan Spaceport & Cosmic Constellations",
    location: "Sriharikota & Deep Space",
    quote: "Empowered by high-performance intelligence, calibrated for Indian academia.",
    skyGradient: "linear-gradient(180deg, #040814 0%, #07132a 30%, #0b2246 60%, #171c4d 85%, #080d1e 100%)",
    ambientColor: "rgba(56, 189, 248, 0.18)",
    accentGlow: "rgba(129, 140, 248, 0.22)",
    bannerBadge: "🚀 Deep Intelligence",
    bannerTitle: "ISRO Constellation",
    bannerSubtitle: "Sriharikota Spaceport",
    svgType: "isro-nebula"
  },

  // 8. STORE / PRO: Royal Peacock & Golden Silk Bazaar
  store: {
    id: "store",
    name: "Royal Peacock & Imperial Silk",
    landmark: "Mysore Palace & Golden Silk Heritage",
    location: "Karnataka",
    quote: "Exclusive badge enhancements, custom themes, and unlimited community superpowers.",
    skyGradient: "linear-gradient(180deg, #0a0814 0%, #1a102b 35%, #311538 70%, #3d2122 90%, #150a12 100%)",
    ambientColor: "rgba(234, 179, 8, 0.16)",
    accentGlow: "rgba(244, 63, 94, 0.18)",
    bannerBadge: "👑 Imperial Gold",
    bannerTitle: "Mysore Royal Palace",
    bannerSubtitle: "Mysuru, Karnataka",
    svgType: "mysore"
  },

  // 9. PROFILE: Lotus Bloom & Indian Filigree Mandala
  profile: {
    id: "profile",
    name: "Lotus Mandala Sanctuary",
    landmark: "Lotus Temple & Heritage Filigree",
    location: "New Delhi",
    quote: "Your personalized identity, badges, communities, and contributions.",
    skyGradient: "linear-gradient(180deg, #080d18 0%, #101930 40%, #1e1b38 75%, #2a1b30 90%, #0c0e18 100%)",
    ambientColor: "rgba(99, 102, 241, 0.14)",
    accentGlow: "rgba(236, 72, 153, 0.14)",
    bannerBadge: "🪷 Identity Sanctuary",
    bannerTitle: "Lotus Sanctuary",
    bannerSubtitle: "New Delhi",
    svgType: "lotus"
  },

  // 10. LOGIN: Sunrise Silhouette over Indian Monument Domes
  login: {
    id: "login",
    name: "Dawn of Bharat",
    landmark: "Sunrise across Monument Domes & Rivers",
    location: "Bharat",
    quote: "Connect • Share • Belong",
    skyGradient: "linear-gradient(180deg, #070914 0%, #180f2b 28%, #36173d 52%, #68233c 72%, #a83d33 88%, #d9682b 97%, #ff9933 100%)",
    ambientColor: "rgba(255, 153, 51, 0.18)",
    accentGlow: "rgba(244, 63, 94, 0.22)",
    bannerBadge: "🌅 Apna Social Space",
    bannerTitle: "Sunrise over Bharat",
    bannerSubtitle: "A new social chapter for Indian students",
    svgType: "sunrise-monuments"
  }
};

/**
 * Get active theme by current pathname
 */
export function getThemeForPath(pathname = "/") {
  if (pathname === "/login" || pathname === "/register" || pathname === "/verify") {
    return PAGE_THEMES.login;
  }
  if (pathname.startsWith("/explore")) {
    return PAGE_THEMES.explore;
  }
  if (pathname.startsWith("/search")) {
    return PAGE_THEMES.search;
  }
  if (pathname.startsWith("/communities") || pathname.startsWith("/study-rooms")) {
    return PAGE_THEMES.communities;
  }
  if (pathname.startsWith("/messages")) {
    return PAGE_THEMES.messages;
  }
  if (pathname.startsWith("/notifications") || pathname.startsWith("/follow-requests")) {
    return PAGE_THEMES.notifications;
  }
  if (pathname.startsWith("/ai")) {
    return PAGE_THEMES.ai;
  }
  if (pathname.startsWith("/store") || pathname.startsWith("/pro")) {
    return PAGE_THEMES.store;
  }
  if (pathname.startsWith("/profile")) {
    return PAGE_THEMES.profile;
  }
  return PAGE_THEMES.home;
}
