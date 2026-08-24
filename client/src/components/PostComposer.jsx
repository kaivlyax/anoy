import { useState } from "react";
import { postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  ImageIcon,
  VideoIcon,
  XIcon,
  LoaderIcon
} from "./Icons";

function PostComposer({ onPostCreated, autoFocus = false }) {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");
  const [mediaList, setMediaList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const username = user?.username || "user";
  const displayName = profile?.displayName || username;
  const avatarLetter = (displayName || username).charAt(0).toUpperCase();

  const handleAddMedia = () => {
    if (!mediaUrl.trim()) return;

    setMediaList((prev) => [
      ...prev,
      {
        url: mediaUrl.trim(),
        type: mediaType
      }
    ]);
    setMediaUrl("");
    setShowMediaInput(false);
  };

  const handleRemoveMedia = (index) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    if (!content.trim() && mediaList.length === 0) {
      addToast("Please write something or attach media", "error");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        content: content.trim(),
        visibility,
        media: mediaList
      };

      const response = await postApi.createPost(payload);

      if (response.data.success) {
        addToast("Post published!", "success");
        setContent("");
        setMediaList([]);
        setMediaUrl("");
        setShowMediaInput(false);

        if (onPostCreated) {
          const newPost = {
            ...response.data.post,
            author: {
              _id: user.id || user._id,
              username: user.username
            },
            likeCount: 0,
            isLiked: false,
            commentCount: 0
          };
          onPostCreated(newPost);
        }
      }
    } catch (err) {
      console.error(err);
      addToast(
        err.response?.data?.message || "Failed to create post. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="composer-card">
      {/* Author Avatar */}
      <div className="composer-avatar">
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={username}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          avatarLetter
        )}
      </div>

      <div className="composer-body">
        {/* Textarea */}
        <textarea
          id="post-composer-input"
          className="composer-textarea"
          placeholder="What's happening in your network?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={5000}
          autoFocus={autoFocus}
          rows={content.split("\n").length > 2 ? 4 : 2}
          aria-label="Post content input"
        />

        {/* Render Attached Media Previews */}
        {mediaList.map((m, idx) => (
          <div key={idx} className="composer-media-preview">
            {m.type === "IMAGE" ? (
              <img
                src={m.url}
                alt="Attached preview"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/600x300?text=Invalid+Image+URL";
                }}
              />
            ) : (
              <video src={m.url} controls />
            )}
            <button
              className="remove-media-btn"
              onClick={() => handleRemoveMedia(idx)}
              title="Remove media"
              aria-label="Remove attached media"
            >
              <XIcon size={16} />
            </button>
          </div>
        ))}

        {/* Media URL Input Box */}
        {showMediaInput && (
          <div className="composer-media-input-bar">
            <select
              className="composer-media-type-select"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              aria-label="Media Type"
            >
              <option value="IMAGE">Image URL</option>
              <option value="VIDEO">Video URL</option>
            </select>

            <input
              type="url"
              placeholder={`Paste ${mediaType.toLowerCase()} direct URL...`}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddMedia();
                }
              }}
              aria-label="Media direct URL"
            />

            <button
              type="button"
              className="composer-submit-btn"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={handleAddMedia}
            >
              Add
            </button>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setShowMediaInput(false)}
              aria-label="Cancel media input"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}

        {/* Composer Footer Controls */}
        <div className="composer-footer">
          <div className="composer-actions">
            <button
              type="button"
              className={`composer-tool-btn ${showMediaInput ? "active" : ""}`}
              onClick={() => {
                setShowMediaInput((prev) => !prev);
                setMediaType("IMAGE");
              }}
              title="Add Image or Video URL"
              aria-label="Attach Image"
            >
              <ImageIcon size={19} />
            </button>

            <button
              type="button"
              className="composer-tool-btn"
              onClick={() => {
                setShowMediaInput(true);
                setMediaType("VIDEO");
              }}
              title="Add Video URL"
              aria-label="Attach Video"
            >
              <VideoIcon size={19} />
            </button>

            {/* Visibility Selector */}
            <select
              className="composer-visibility-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              aria-label="Post visibility"
            >
              <option value="PUBLIC">🌐 Public</option>
              <option value="FOLLOWERS">👥 Followers</option>
              <option value="PRIVATE">🔒 Private</option>
            </select>
          </div>

          <div className="composer-submit-group">
            {content.length > 0 && (
              <span className="composer-char-count">
                {5000 - content.length}
              </span>
            )}

            <button
              className="composer-submit-btn"
              disabled={submitting || (!content.trim() && mediaList.length === 0)}
              onClick={handleSubmit}
              aria-label="Submit Post"
            >
              {submitting ? (
                <>
                  <LoaderIcon size={16} />
                  <span>Posting...</span>
                </>
              ) : (
                <span>Post</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostComposer;
