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
  decoration = "",
  isOnline = false,
  className = "",
  onClick,
  children
}) {
  const activeFrame = decoration || frame || "";
  const frameClass =
    activeFrame && activeFrame !== "none"
      ? `avatar-frame-${activeFrame.replace(/^frame_/, "").replace(/_/g, "-")}`
      : "";

  const numericSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 34
      : size === "md"
      ? 46
      : size === "lg"
      ? 56
      : size === "xl"
      ? 68
      : parseInt(size, 10) || 40;

  return (
    <div
      className={`avatar-frame-wrapper ${frameClass} ${className}`}
      style={{ width: numericSize, height: numericSize }}
      onClick={onClick}
    >
      <div className="avatar-frame-inner" style={{ width: numericSize, height: numericSize }}>
        {children ? (
          children
        ) : (
          <>
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
              style={{
                display: src ? "none" : "flex",
                fontSize: Math.max(12, Math.floor(numericSize * 0.42))
              }}
            >
              {fallbackText?.charAt(0)?.toUpperCase() || "A"}
            </div>
          </>
        )}
      </div>
      {isOnline && <span className="avatar-presence-dot" />}
    </div>
  );
}

