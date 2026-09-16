/**
 * AvatarFrame Component
 * Renders avatar with optional animated frame decorations and online status.
 */
export default function AvatarFrame({
  src,
  alt = "User Avatar",
  fallbackText = "A",
  size = 40,
  frame = "",
  isOnline = false,
  className = "",
  onClick
}) {
  const frameClass = frame && frame !== "none" ? `avatar-frame-${frame.replace(/^frame_/, "").replace(/_/g, "-")}` : "";

  return (
    <div
      className={`avatar-frame-wrapper ${frameClass} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <div className="avatar-frame-inner" style={{ width: size, height: size }}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className="avatar-frame-img"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = "flex";
              }
            }}
          />
        ) : null}
        <div
          className="avatar-frame-fallback"
          style={{ display: src ? "none" : "flex", fontSize: Math.max(12, Math.floor(size * 0.42)) }}
        >
          {fallbackText?.charAt(0)?.toUpperCase() || "A"}
        </div>
      </div>
      {isOnline && <span className="avatar-presence-dot" />}
    </div>
  );
}
