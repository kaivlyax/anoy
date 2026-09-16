import { useEffect, useRef } from "react";
import { ScreenShareIcon, MaximizeIcon } from "./Icons";

export default function ScreenShareView({ stream, presenterName, isLocal }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.warn);
    } else {
      document.exitFullscreen().catch(console.warn);
    }
  };

  return (
    <div className="screen-share-container" ref={containerRef}>
      <div className="screen-share-header">
        <div className="screen-share-badge">
          <ScreenShareIcon size={16} />
          <span>{isLocal ? "You are presenting" : `${presenterName || "Student"} is presenting`}</span>
        </div>
        <button
          type="button"
          className="screen-share-btn"
          onClick={toggleFullscreen}
          title="Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <MaximizeIcon size={18} />
        </button>
      </div>

      <div className="screen-share-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="screen-share-video"
        />
      </div>
    </div>
  );
}
