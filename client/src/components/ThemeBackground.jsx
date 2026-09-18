import React from "react";
import { useLocation } from "react-router-dom";
import { getThemeForPath } from "../config/pageThemes";

/**
 * ThemeBackground Component
 * Renders an atmospheric Indian landmark vector backdrop
 * calibrated with dynamic twilight/dusk gradients and silhouetted architectural art.
 */
export function ThemeBackground() {
  const location = useLocation();
  const theme = getThemeForPath(location.pathname);

  return (
    <div
      className="anoy-theme-background"
      style={{
        background: theme.skyGradient
      }}
      aria-hidden="true"
    >
      {/* Background SVG Artwork Layer */}
      <div className="anoy-theme-scene">
        {renderSvgScene(theme.svgType)}
      </div>

      {/* Atmospheric Starry Dust Layer */}
      <div className="anoy-theme-stars" />

      {/* Subtle Radiant Vignette Overlay */}
      <div
        className="anoy-theme-glow"
        style={{
          boxShadow: `inset 0 0 140px ${theme.ambientColor}`
        }}
      />
    </div>
  );
}

/**
 * Helper to render lightweight vector scenes for Indian monuments
 */
function renderSvgScene(svgType) {
  switch (svgType) {
    case "taj-mahal":
      return (
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="monument-svg-art taj-mahal-art"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <linearGradient id="tajSilhouette" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(40, 20, 50, 0.45)" />
              <stop offset="60%" stopColor="rgba(25, 14, 34, 0.75)" />
              <stop offset="100%" stopColor="rgba(15, 10, 24, 0.95)" />
            </linearGradient>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255, 153, 51, 0.35)" />
              <stop offset="50%" stopColor="rgba(236, 72, 153, 0.15)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          {/* Glowing Sunset Orb behind Taj Dome */}
          <circle cx="720" cy="380" r="220" fill="url(#sunGlow)" />

          {/* Left Minaret */}
          <path d="M410 490 L425 210 L435 210 L450 490 Z" fill="url(#tajSilhouette)" />
          <path d="M415 210 C420 180, 440 180, 445 210 Z" fill="url(#tajSilhouette)" />
          <rect x="428" y="170" width="4" height="20" fill="url(#tajSilhouette)" />
          <rect x="412" y="320" width="36" height="6" rx="2" fill="url(#tajSilhouette)" />
          <rect x="416" y="410" width="28" height="6" rx="2" fill="url(#tajSilhouette)" />

          {/* Outer Left Minaret */}
          <path d="M260 500 L272 260 L282 260 L294 500 Z" fill="url(#tajSilhouette)" opacity="0.8" />
          <path d="M266 260 C270 235, 284 235, 288 260 Z" fill="url(#tajSilhouette)" opacity="0.8" />

          {/* Center Main Taj Dome Complex */}
          {/* Main Dome */}
          <path
            d="M650 360 C650 250, 680 160, 720 130 C760 160, 790 250, 790 360 Z"
            fill="url(#tajSilhouette)"
          />
          {/* Spire / Finial */}
          <rect x="718" y="90" width="4" height="42" fill="url(#tajSilhouette)" />
          <circle cx="720" cy="86" r="5" fill="url(#tajSilhouette)" />

          {/* Left Side Small Dome */}
          <path d="M590 360 C590 290, 610 240, 630 220 C650 240, 670 290, 670 360 Z" fill="url(#tajSilhouette)" />
          <rect x="629" y="200" width="3" height="22" fill="url(#tajSilhouette)" />

          {/* Right Side Small Dome */}
          <path d="M770 360 C770 290, 790 240, 810 220 C830 240, 850 290, 850 360 Z" fill="url(#tajSilhouette)" />
          <rect x="809" y="200" width="3" height="22" fill="url(#tajSilhouette)" />

          {/* Main Facade and Grand Arch */}
          <path d="M560 500 L560 360 L880 360 L880 500 Z" fill="url(#tajSilhouette)" />
          {/* Central Archway Cavity */}
          <path
            d="M670 500 L670 410 C670 380, 770 380, 770 410 L770 500 Z"
            fill="rgba(12, 7, 18, 0.95)"
          />

          {/* Right Minaret */}
          <path d="M990 490 L1005 210 L1015 210 L1030 490 Z" fill="url(#tajSilhouette)" />
          <path d="M995 210 C1000 180, 1020 180, 1025 210 Z" fill="url(#tajSilhouette)" />
          <rect x="1008" y="170" width="4" height="20" fill="url(#tajSilhouette)" />
          <rect x="992" y="320" width="36" height="6" rx="2" fill="url(#tajSilhouette)" />
          <rect x="996" y="410" width="28" height="6" rx="2" fill="url(#tajSilhouette)" />

          {/* Outer Right Minaret */}
          <path d="M1146 500 L1158 260 L1168 260 L1180 500 Z" fill="url(#tajSilhouette)" opacity="0.8" />
          <path d="M1152 260 C1156 235, 1170 235, 1174 260 Z" fill="url(#tajSilhouette)" opacity="0.8" />

          {/* Reflecting Pool & Water Ripples */}
          <rect x="0" y="490" width="1440" height="110" fill="rgba(10, 6, 18, 0.9)" />
          <line x1="300" y1="520" x2="1140" y2="520" stroke="rgba(255, 153, 51, 0.15)" strokeWidth="2" strokeDasharray="10 20" />
          <line x1="450" y1="545" x2="990" y2="545" stroke="rgba(236, 72, 153, 0.1)" strokeWidth="1.5" strokeDasharray="15 30" />
          <line x1="580" y1="570" x2="860" y2="570" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="8 16" />
        </svg>
      );

    case "sunrise-monuments":
    case "login":
      return (
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="monument-svg-art sunrise-art"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <radialGradient id="dawnSun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffb347" stopOpacity="0.6" />
              <stop offset="35%" stopColor="#ff7043" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#d81b60" stopOpacity="0.15" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="monumentSil" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(45, 15, 30, 0.55)" />
              <stop offset="100%" stopColor="rgba(15, 8, 16, 0.98)" />
            </linearGradient>
          </defs>

          {/* Grand Rising Sun */}
          <circle cx="720" cy="370" r="280" fill="url(#dawnSun)" />

          {/* Background Mountainous / River ridge */}
          <path
            d="M0 480 Q360 420, 720 450 T1440 430 L1440 600 L0 600 Z"
            fill="rgba(25, 10, 20, 0.6)"
          />

          {/* Domes & Temple Shikharas Across Bharat Horizon */}
          {/* Left Temple Spires */}
          <path d="M120 480 L160 300 L200 480 Z" fill="url(#monumentSil)" />
          <path d="M220 490 C220 380, 270 320, 310 290 C350 320, 400 380, 400 490 Z" fill="url(#monumentSil)" />
          <rect x="308" y="260" width="4" height="32" fill="url(#monumentSil)" />

          {/* Center Monument Silhouettes */}
          <path d="M520 490 L535 270 L545 270 L560 490 Z" fill="url(#monumentSil)" />
          <path d="M640 490 C640 370, 680 250, 720 220 C760 250, 800 370, 800 490 Z" fill="url(#monumentSil)" />
          <rect x="718" y="180" width="4" height="42" fill="url(#monumentSil)" />
          <path d="M880 490 L895 270 L905 270 L920 490 Z" fill="url(#monumentSil)" />

          {/* Right Fortress & Archways */}
          <path d="M1040 500 C1040 400, 1080 340, 1130 320 C1180 340, 1220 400, 1220 500 Z" fill="url(#monumentSil)" />
          <path d="M1260 510 L1300 330 L1340 510 Z" fill="url(#monumentSil)" />

          {/* River Yamuna / Ganga Shimmer */}
          <rect x="0" y="490" width="1440" height="110" fill="rgba(12, 6, 14, 0.95)" />
          <path d="M200 530 C450 520, 950 540, 1240 530" stroke="rgba(255, 153, 51, 0.25)" strokeWidth="2" strokeDasharray="16 24" />
          <path d="M380 560 C600 550, 840 570, 1060 560" stroke="rgba(244, 63, 94, 0.18)" strokeWidth="1.5" strokeDasharray="20 30" />
        </svg>
      );

    case "india-gate":
      return (
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="monument-svg-art india-gate-art"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <linearGradient id="gateSil" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(20, 35, 60, 0.6)" />
              <stop offset="100%" stopColor="rgba(8, 14, 24, 0.95)" />
            </linearGradient>
            <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.3)" />
              <stop offset="60%" stopColor="rgba(99, 102, 241, 0.12)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Beacon Aura */}
          <circle cx="720" cy="320" r="260" fill="url(#beaconGlow)" />

          {/* India Gate Structure */}
          {/* Main Top Crown */}
          <rect x="580" y="200" width="280" height="30" rx="3" fill="url(#gateSil)" />
          <rect x="610" y="170" width="220" height="30" rx="4" fill="url(#gateSil)" />
          <rect x="660" y="150" width="120" height="20" rx="2" fill="url(#gateSil)" />

          {/* Pylons & Center Arch */}
          <path
            d="M580 230 L860 230 L860 480 L790 480 L790 320 C790 280, 650 280, 650 320 L650 480 L580 480 Z"
            fill="url(#gateSil)"
          />

          {/* Amar Jawan Jyoti Flame Hint */}
          <circle cx="720" cy="450" r="4" fill="#FF9933" />
          <circle cx="720" cy="450" r="10" fill="rgba(255, 153, 51, 0.3)" />

          {/* Rajpath Avenue Base */}
          <rect x="0" y="480" width="1440" height="120" fill="rgba(8, 12, 20, 0.96)" />
        </svg>
      );

    case "isro-nebula":
      return (
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="monument-svg-art isro-art"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <radialGradient id="nebulaGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.28)" />
              <stop offset="50%" stopColor="rgba(129, 140, 248, 0.15)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Deep Space Nebula Glow */}
          <circle cx="720" cy="280" r="300" fill="url(#nebulaGlow)" />

          {/* Planetary Orbital Rings */}
          <ellipse cx="720" cy="300" rx="420" ry="120" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" strokeDasharray="6 10" transform="rotate(-15 720 300)" />
          <ellipse cx="720" cy="300" rx="260" ry="80" stroke="rgba(129, 140, 248, 0.2)" strokeWidth="1.2" transform="rotate(20 720 300)" />

          {/* Satellite / Spacecraft Silhouette */}
          <g transform="translate(680, 220) scale(0.9)">
            <rect x="25" y="15" width="30" height="20" rx="3" fill="rgba(56, 189, 248, 0.8)" />
            {/* Solar Panels */}
            <rect x="0" y="18" width="20" height="14" rx="2" fill="rgba(129, 140, 248, 0.6)" />
            <rect x="60" y="18" width="20" height="14" rx="2" fill="rgba(129, 140, 248, 0.6)" />
            <line x1="40" y1="15" x2="40" y2="5" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="40" cy="4" r="3" fill="#38bdf8" />
          </g>

          {/* Distant ISRO Launch Pad Spire */}
          <path d="M1100 480 L1110 320 L1120 320 L1130 480 Z" fill="rgba(20, 30, 55, 0.6)" />
          <rect x="0" y="480" width="1440" height="120" fill="rgba(4, 8, 16, 0.96)" />
        </svg>
      );

    default:
      // Default Indian Heritage Dome & Palace Silhouette
      return (
        <svg
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="monument-svg-art default-art"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <radialGradient id="defaultGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255, 153, 51, 0.2)" />
              <stop offset="70%" stopColor="rgba(99, 102, 241, 0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="720" cy="360" r="260" fill="url(#defaultGlow)" />
          <path
            d="M600 480 C600 370, 650 260, 720 230 C790 260, 840 370, 840 480 Z"
            fill="rgba(30, 20, 40, 0.5)"
          />
          <rect x="718" y="190" width="4" height="40" fill="rgba(30, 20, 40, 0.5)" />
          <rect x="0" y="480" width="1440" height="120" fill="rgba(10, 14, 26, 0.95)" />
        </svg>
      );
  }
}

export default ThemeBackground;
