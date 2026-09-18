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
    <div className="taj-welcome-hero">
      <div className="taj-hero-content">
        <div className="taj-hero-badge">
          <span>🇮🇳</span>
          <span>Apna Social Space</span>
        </div>

        <h1 className="taj-hero-title">
          {getGreeting()}, <span className="taj-hero-title-highlight">{displayName}</span> 👋
        </h1>

        <p className="taj-hero-subtitle">
          &ldquo;Ideas from India. For a brighter tomorrow.&rdquo;
        </p>
      </div>

      <div className="taj-hero-art" aria-hidden="true">
        <svg
          viewBox="0 0 160 100"
          className="taj-hero-silhouette-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="tajSunGlow" cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="rgba(255, 153, 51, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="tajSil" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 153, 51, 0.6)" />
              <stop offset="100%" stopColor="rgba(236, 72, 153, 0.3)" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="50" r="40" fill="url(#tajSunGlow)" />
          {/* Taj Silhouette */}
          <path d="M70 70 C70 45, 76 32, 80 28 C84 32, 90 45, 90 70 Z" fill="url(#tajSil)" />
          <rect x="79.5" y="22" width="1" height="7" fill="#FF9933" />
          <path d="M56 70 L58 40 L60 40 L62 70 Z" fill="url(#tajSil)" />
          <path d="M98 70 L100 40 L102 40 L104 70 Z" fill="url(#tajSil)" />
          <rect x="52" y="70" width="56" height="4" fill="url(#tajSil)" />
        </svg>
      </div>
    </div>
  );
}

export default TajWelcomeHero;
