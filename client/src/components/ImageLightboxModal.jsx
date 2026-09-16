import { useEffect } from "react";
import { XIcon, DownloadIcon } from "./Icons";

export default function ImageLightboxModal({ isOpen, imageUrl, originalName, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = originalName || "anoy-chat-image.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="lightbox-btn"
          onClick={handleDownload}
          title="Download Image"
          aria-label="Download Image"
        >
          <DownloadIcon size={20} />
          <span>Download</span>
        </button>
        <button
          type="button"
          className="lightbox-btn lightbox-close-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <XIcon size={22} />
        </button>
      </div>

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt={originalName || "Enlarged view"} className="lightbox-image" />
      </div>
    </div>
  );
}
