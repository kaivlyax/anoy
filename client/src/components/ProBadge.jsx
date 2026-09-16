import { SparklesIcon } from "./Icons";

/**
 * Modern PRO Badge with sleek gradient background, sparkles icon, and glowing shadow.
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - Optional custom class
 */
export default function ProBadge({ size = "sm", className = "", showIcon = true }) {
  const sizeClasses = {
    sm: "pro-badge-sm",
    md: "pro-badge-md",
    lg: "pro-badge-lg"
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  };

  return (
    <span className={`pro-badge ${sizeClasses[size] || "pro-badge-sm"} ${className}`} title="ANOY Pro Member">
      {showIcon && <SparklesIcon size={iconSizes[size] || 10} className="pro-badge-icon" />}
      <span className="pro-badge-text">PRO</span>
    </span>
  );
}
