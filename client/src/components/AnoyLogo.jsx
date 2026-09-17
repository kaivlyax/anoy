import React from "react";
import { Link } from "react-router-dom";

/**
 * AnoyLogo Component
 * Features:
 * - Geometric modern "ANOY" wordmark
 * - Orange/Saffron circular dot centered in 'O'
 * - Tri-color Indian plume/feather/leaf motif extending from the right arm of 'Y' (Saffron -> White/Navy -> Green)
 * - Hand-drawn cursive "Apna Social Space" script in Caveat font
 * - Curved tricolor underline / swoosh arc
 * - Spaced tracking subtitle (e.g. "CONNECT • SHARE • BELONG")
 * 
 * Variants:
 * - "login": Hero size with full tagline, tricolor arc, and tracking subtitle
 * - "sidebar": Medium size optimized for sidebar header
 * - "hero": Large banner lockup
 * - "navbar": Compact mobile header lockup
 * - "compact": Minimalist logo without subtitles
 */
export function AnoyLogo({
  variant = "sidebar",
  className = "",
  showTagline = true,
  showSubtext = false,
  clickable = true
}) {
  const isLogin = variant === "login";
  const isSidebar = variant === "sidebar";
  const isHero = variant === "hero";
  const isNavbar = variant === "navbar";
  const isCompact = variant === "compact";

  // Scale variables based on variant
  let logoSize = 28;
  let wordmarkSize = 26;
  let cursiveSize = 18;
  let subtextSize = 10;

  if (isLogin) {
    logoSize = 56;
    wordmarkSize = 48;
    cursiveSize = 26;
    subtextSize = 11;
  } else if (isHero) {
    logoSize = 44;
    wordmarkSize = 38;
    cursiveSize = 22;
    subtextSize = 11;
  } else if (isNavbar || isCompact) {
    logoSize = 24;
    wordmarkSize = 22;
    cursiveSize = 14;
    subtextSize = 9;
  }

  const logoGraphic = (
    <div className={`anoy-brand-lockup anoy-brand-${variant} ${className}`}>
      {/* Top Main Wordmark Row */}
      <div className="anoy-wordmark-container">
        {/* SVG Wordmark with customized 'O' and 'Y' plumes */}
        <svg
          className="anoy-svg-wordmark"
          viewBox="0 0 200 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ height: wordmarkSize * 1.3, width: "auto", overflow: "visible" }}
          aria-label="ANOY Logo"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="anoyTextGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            <linearGradient id="saffronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9933" />
              <stop offset="100%" stopColor="#FF6F00" />
            </linearGradient>

            <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#138808" />
              <stop offset="100%" stopColor="#0a5c05" />
            </linearGradient>

            <linearGradient id="tricolorCurve" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF9933" />
              <stop offset="45%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#000080" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#138808" />
            </linearGradient>

            <filter id="glowSaffron" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#FF9933" floodOpacity="0.6" />
            </filter>
            <filter id="glowPlume" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FF9933" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Letter 'A' */}
          <path
            d="M20 50 L34 10 L48 50 L38 50 L34 38 L24 38 L20 50 Z M27 28 L31 18 L35 28 Z"
            fill="url(#anoyTextGrad)"
          />

          {/* Letter 'N' */}
          <path
            d="M58 50 L58 10 L68 10 L84 37 L84 10 L94 10 L94 50 L84 50 L68 23 L68 50 Z"
            fill="url(#anoyTextGrad)"
          />

          {/* Letter 'O' with outer ring and central saffron dot */}
          <g>
            <path
              d="M118 10 C130 10 138 19 138 30 C138 41 130 50 118 50 C106 50 98 41 98 30 C98 19 106 10 118 10 Z M118 20 C112 20 108 24 108 30 C108 36 112 40 118 40 C124 40 128 36 128 30 C128 24 124 20 118 20 Z"
              fill="url(#anoyTextGrad)"
            />
            {/* Saffron Center Sun Dot in 'O' */}
            <circle
              cx="118"
              cy="30"
              r="4.2"
              fill="url(#saffronGrad)"
              filter="url(#glowSaffron)"
            />
            <circle
              cx="118"
              cy="30"
              r="1.8"
              fill="#FFFFFF"
              opacity="0.9"
            />
          </g>

          {/* Letter 'Y' */}
          <path
            d="M145 10 L157 28 L157 50 L167 50 L167 28 L179 10 L167 10 L162 20 L157 10 Z"
            fill="url(#anoyTextGrad)"
          />

          {/* Tricolor Feather / Leaf / Plume on 'Y' arm */}
          <g filter="url(#glowPlume)" transform="translate(170, 0)">
            {/* Top Saffron Plume Petal */}
            <path
              d="M3 14 C6 8, 14 3, 22 2 C18 9, 13 14, 7 17 Z"
              fill="url(#saffronGrad)"
            />
            {/* Middle White Plume with Ashoka Chakra hint */}
            <path
              d="M5 16 C9 12, 17 8, 25 8 C20 14, 15 18, 9 20 Z"
              fill="#FFFFFF"
            />
            <circle cx="15" cy="13" r="1.4" fill="#000080" />

            {/* Bottom Green Plume Petal */}
            <path
              d="M7 19 C11 16, 18 13, 26 15 C19 19, 14 24, 9 24 Z"
              fill="url(#greenGrad)"
            />

            {/* Sparkle accent */}
            <circle cx="23" cy="2" r="1.5" fill="#FFD700" opacity="0.9" />
          </g>
        </svg>
      </div>

      {/* Hand-drawn Cursive Tagline: "Apna Social Space" */}
      {showTagline && (
        <div className="anoy-tagline-wrapper">
          <span
            className="anoy-tagline-cursive"
            style={{
              fontSize: cursiveSize,
              fontFamily: "'Caveat', cursive",
              lineHeight: 1.1
            }}
          >
            Apna Social Space
          </span>

          {/* Curved tricolor underline swoosh */}
          <div className="anoy-tricolor-swoosh" />
        </div>
      )}

      {/* Subtext: "CONNECT • SHARE • BELONG" */}
      {(showSubtext || isLogin) && (
        <div
          className="anoy-subtext-tracking"
          style={{ fontSize: subtextSize }}
        >
          CONNECT • SHARE • BELONG
        </div>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link
        to="/"
        className="brand-logo-link"
        aria-label="ANOY — Apna Social Space"
        style={{ textDecoration: "none", display: "inline-block" }}
      >
        {logoGraphic}
      </Link>
    );
  }

  return logoGraphic;
}

export default AnoyLogo;
