import React from "react";
import { useAuth } from "../context/AuthContext";
import { SparklesIcon } from "./Icons";

/**
 * TajWelcomeHero Component
 * Inspired by Reference 2:
 * - Dynamic time-of-day greeting (Good Morning / Afternoon / Evening / Night)
 * - User Display Name with wave emoji
 * - Elegant italic quote in Lora font: "Ideas from India. For a brighter tomorrow."
 * - Mini Bharat pill badge: "🇮🇳 Apna Social Space"
 * - Subtitle mentioning landmark location "Taj Mahal Sunset • Agra, Uttar Pradesh"
 */
export function TajWelcomeHero() {
  const { user, profile } = useAuth();

  const username = user?.username || "Student";
  const displayName = profile?.displayName || username;

  // Determine dynamic greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 22) return "Good Evening";
    return "Good Night";
  };

  return (
    <div className="taj-welcome-hero glass-panel-glow">
      {/* Background Taj Mahal Vector Silhouette Layer */}
      <div className="taj-hero-art-layer" aria-hidden="true">
        <svg
          viewBox="0 0 800 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="taj-hero-svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="heroSunGlow" cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="rgba(255, 153, 51, 0.28)" />
              <stop offset="60%" stopColor="rgba(236, 72, 153, 0.12)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="heroTajSilhouette" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
              <stop offset="100%" stopColor="rgba(10, 14, 28, 0.85)" />
            </linearGradient>
          </defs>

          {/* Sunset Orb */}
          <circle cx="680" cy="120" r="140" fill="url(#heroSunGlow)" />

          {/* Taj Mahal Silhouettes on the right side of hero */}
          <g transform="translate(480, 20) scale(0.65)" opacity="0.6">
            {/* Left Minaret */}
            <path d="M40 260 L48 100 L54 100 L62 260 Z" fill="url(#heroTajSilhouette)" />
            <path d="M43 100 C46 80, 56 80, 59 100 Z" fill="url(#heroTajSilhouette)" />

            {/* Central Dome */}
            <path d="M190 260 C190 170, 210 100, 240 80 C270 100, 290 170, 290 260 Z" fill="url(#heroTajSilhouette)" />
            <rect x="238" y="55" width="4" height="28" fill="url(#heroTajSilhouette)" />
            <circle cx="240" cy="52" r="4" fill="url(#heroTajSilhouette)" />

            {/* Left Small Dome */}
            <path d="M150 260 C150 200, 165 160, 180 145 C195 160, 210 200, 210 260 Z" fill="url(#heroTajSilhouette)" />

            {/* Right Small Dome */}
            <path d="M270 260 C270 200, 285 160, 300 145 C315 160, 330 200, 330 260 Z" fill="url(#heroTajSilhouette)" />

            {/* Main Arch Base */}
            <path d="M130 260 L130 160 L350 160 L350 260 Z" fill="url(#heroTajSilhouette)" />
            <path d="M210 260 L210 200 C210 180, 270 180, 270 200 L270 260 Z" fill="rgba(10, 14, 28, 0.95)" />

            {/* Right Minaret */}
            <path d="M420 260 L428 100 L434 100 L442 260 Z" fill="url(#heroTajSilhouette)" />
            <path d="M423 100 C426 80, 436 80, 439 100 Z" fill="url(#heroTajSilhouette)" />
          </g>
        </svg>
      </div>

      {/* Hero Content */}
      <div className="taj-hero-content">
        <div className="taj-hero-badge-row">
          <span className="taj-hero-badge">
            <span className="flag-icon">🇮🇳</span> Apna Social Space
          </span>
          <span className="taj-location-tag">
            Taj Mahal Sunset • Agra, Uttar Pradesh
          </span>
        </div>

        <h1 className="taj-hero-greeting">
          {getGreeting()}, <span className="taj-greeting-name">{displayName}</span> 👋
        </h1>

        <p className="taj-hero-quote">
          &ldquo;Ideas from India. For a brighter tomorrow.&rdquo;
        </p>
      </div>
    </div>
  );
}

export default TajWelcomeHero;
