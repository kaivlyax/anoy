import { useEffect, useRef } from "react";
import { MicOffIcon } from "./Icons";
import AvatarFrame from "./AvatarFrame";
import ProBadge from "./ProBadge";

export default function VideoTile({
  stream,
  user,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  isSpeaking = false
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const displayName = user?.displayName || user?.username || "Student";
  const avatarLetter = (displayName || "S").charAt(0).toUpperCase();

  return (
    <div
      className={`video-tile ${isSpeaking ? "speaking" : ""} ${isScreenSharing ? "screen-tile" : ""}`}
    >
      {/* Video Element */}
      {!isVideoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`video-element ${isLocal && !isScreenSharing ? "mirror" : ""}`}
        />
      ) : (
        /* Avatar Placeholder when video is off */
        <div className="video-avatar-fallback">
          <AvatarFrame decoration={user?.avatarDecoration} size="lg">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="video-avatar-img" />
            ) : (
              <div className="video-avatar-placeholder">{avatarLetter}</div>
            )}
          </AvatarFrame>
          <div className="video-fallback-name">{displayName}</div>
        </div>
      )}

      {/* Overlay Information & Status Badges */}
      <div className="video-tile-overlay">
        <div className="video-tile-user-info">
          <span className="video-tile-username">
            {displayName} {isLocal && "(You)"}
          </span>
          {user?.isPro && <ProBadge size="sm" />}
        </div>

        <div className="video-tile-status-icons">
          {isMuted && (
            <span className="video-status-badge muted" title="Microphone Muted">
              <MicOffIcon size={14} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
