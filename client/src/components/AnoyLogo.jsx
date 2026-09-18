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
  const isHero = variant === "hero";
  const isNavbar = variant === "navbar";
  const isCompact = variant === "compact";

  let svgWidth = 140;
  let svgHeight = 36;
  let cursiveSize = 16;
  let subtextSize = 10;

  if (isLogin) {
    svgWidth = 200;
    svgHeight = 52;
    cursiveSize = 24;
    subtextSize = 11;
  } else if (isHero) {
    svgWidth = 170;
    svgHeight = 44;
    cursiveSize = 20;
    subtextSize = 11;
  } else if (isNavbar || isCompact) {
    svgWidth = 115;
    svgHeight = 30;
    cursiveSize = 13;
    subtextSize = 9;
  }

  const logoGraphic = (
    <div className={`anoy-brand-lockup anoy-brand-${variant} ${className}`}>
      {/* Top Main Wordmark Row */}
      <div className="anoy-wordmark-container">
        <svg
          className="anoy-svg-wordmark"
          viewBox="0 0 160 40"
          width={svgWidth}
          height={svgHeight}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="ANOY Logo"
        >
          <defs>
            <linearGradient id="anoyTextGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>

            <linearGradient id="saffronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9933" />
              <stop offset="100%" stopColor="#FF6F00" />
            </linearGradient>

            <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#138808" />
              <stop offset="100%" stopColor="#0a5c05" />
            </linearGradient>

            <filter id="glowSaffron" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#FF9933" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Clean Geometric Letters */}
          {/* A */}
          <path
            d="M8 34 L21 4 L28 4 L41 34 L32 34 L29 26 L19 26 L16 34 Z M21 20 L27 20 L24.5 12 Z"
            fill="url(#anoyTextGrad)"
            fillRule="evenodd"
          />

          {/* N */}
          <path
            d="M47 34 L47 4 L56 4 L71 25 L71 4 L79 4 L79 34 L70 34 L55 13 L55 34 Z"
            fill="url(#anoyTextGrad)"
          />

          {/* O */}
          <path
            d="M99 4 C110 4 118 11 118 20 C118 29 110 35 99 35 C88 35 80 29 80 20 C80 11 88 4 99 4 Z M99 11 C93 11 88.5 15 88.5 20 C88.5 25 93 29 99 29 C105 29 109.5 25 109.5 20 C109.5 15 105 11 99 11 Z"
            fill="url(#anoyTextGrad)"
            fillRule="evenodd"
          />
          {/* Saffron Center Dot in 'O' */}
          <circle cx="99" cy="20" r="3.8" fill="url(#saffronGrad)" filter="url(#glowSaffron)" />
          <circle cx="99" cy="20" r="1.4" fill="#FFFFFF" />

          {/* Y */}
          <path
            d="M122 4 L132 18 L132 34 L140 34 L140 18 L150 4 L141 4 L136 12 L131 4 Z"
            fill="url(#anoyTextGrad)"
          />

          {/* Tricolor Feather / Plume on 'Y' arm */}
          <g transform="translate(142, 2)">
            {/* Top Saffron Plume */}
            <path
              d="M0 8 C4 3, 11 0, 16 0 C12 5, 8 8, 2 10 Z"
              fill="url(#saffronGrad)"
            />
            {/* Middle White Plume with Chakra dot */}
            <path
              d="M2 9 C6 5, 13 3, 18 3 C14 8, 10 11, 4 12 Z"
              fill="#FFFFFF"
            />
            <circle cx="10" cy="7" r="1.2" fill="#000080" />

            {/* Bottom Green Plume */}
            <path
              d="M3 11 C7 8, 14 6, 20 7 C15 11, 11 14, 5 14 Z"
              fill="url(#greenGrad)"
            />
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
              lineHeight: 1.1,
              color: "#FF9933"
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
