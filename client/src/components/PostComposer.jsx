import { useState, useEffect, useRef } from "react";
import { postApi, mediaApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  ImageIcon,
  VideoIcon,
  XIcon,
  LoaderIcon,
  SparklesIcon
} from "./Icons";

const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 25;
const MAX_TOTAL_FILES = 4;

function PostComposer({ onPostCreated, autoFocus = false }) {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ file, previewUrl, type, name, size }]
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");
  const [urlMediaList, setUrlMediaList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showTopicTags, setShowTopicTags] = useState(false);
  const [trendingTags, setTrendingTags] = useState([]);

  const username = user?.username || "user";
  const displayName = profile?.displayName || username;
  const avatarLetter = (displayName || username).charAt(0).toUpperCase();

  // Load real trending topics when component mounts
  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await postApi.getTrendingTopics(6);
        if (isMounted && res.data.success && res.data.trending) {
          setTrendingTags(res.data.trending.map((t) => t.tag || t.topic));
        }
      } catch {
        // ignore
      }
    };
    fetchTags();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [selectedFiles]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedFiles.length + files.length > MAX_TOTAL_FILES) {
      addToast(`You can attach up to ${MAX_TOTAL_FILES} media files per post.`, "error");
      return;
    }

    const newFiles = [];
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      if (!isImage && !isVideo) {
        addToast(`Unsupported file type: ${file.name}. Please select images or videos.`, "error");
        continue;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (isImage && sizeMB > MAX_IMAGE_SIZE_MB) {
        addToast(`Image "${file.name}" exceeds maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB`, "error");
        continue;
      }
      if (isVideo && sizeMB > MAX_VIDEO_SIZE_MB) {
        addToast(`Video "${file.name}" exceeds maximum allowed size of ${MAX_VIDEO_SIZE_MB}MB`, "error");
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newFiles.push({
        file,
        previewUrl,
        type: isVideo ? "VIDEO" : "IMAGE",
        name: file.name,
        size: (sizeMB).toFixed(1) + "MB"
      });
    }

    if (newFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset file input value so user can pick the same file again if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAddUrlMedia = () => {
    if (!mediaUrl.trim()) return;

    setUrlMediaList((prev) => [
      ...prev,
      {
        url: mediaUrl.trim(),
        type: mediaType
      }
    ]);
    setMediaUrl("");
    setShowMediaInput(false);
  };

  const handleRemoveUrlMedia = (index) => {
    setUrlMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInsertTag = (tag) => {
    setContent((prev) => (prev ? `${prev} ${tag}` : tag));
    setShowTopicTags(false);
  };

  const handleAskQuestion = () => {
    if (!content.startsWith("❓ [Question]")) {
      setContent((prev) => `❓ [Question] ${prev}`);
    }
  };

  const handlePollPrompt = () => {
    if (!content.includes("📊 [Poll]")) {
      setContent((prev) => `${prev ? prev + "\n" : ""}📊 [Poll] 1. Option A | 2. Option B`);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    const hasMedia = selectedFiles.length > 0 || urlMediaList.length > 0;
    if (!content.trim() && !hasMedia) {
      addToast("Please write something or attach photos/videos", "error");
      return;
    }

    try {
      setSubmitting(true);
      const uploadedMedia = [];

      // Upload local files to backend/Cloudinary
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          setUploadStatus(`Uploading media ${i + 1}/${selectedFiles.length}...`);

          const formData = new FormData();
          formData.append("file", item.file);

          try {
            const uploadRes = await mediaApi.uploadImage(formData);
            if (uploadRes.data.success && uploadRes.data.media) {
              uploadedMedia.push({
                url: uploadRes.data.media.url,
                type: uploadRes.data.media.type || item.type
              });
            } else {
              throw new Error(uploadRes.data.message || "Media upload failed");
            }
          } catch (uploadErr) {
            console.error("Failed to upload file:", item.name, uploadErr);
            throw new Error(`Failed to upload ${item.name}: ${uploadErr.response?.data?.message || uploadErr.message}`);
          }
        }
      }

      setUploadStatus("Publishing post...");

      const allMedia = [...uploadedMedia, ...urlMediaList];

      const payload = {
        content: content.trim(),
        visibility,
        media: allMedia
      };

      const response = await postApi.createPost(payload);

      if (response.data.success) {
        addToast("Post published to ANOY!", "success");

        // Cleanup local preview URLs
        selectedFiles.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });

        setContent("");
        setSelectedFiles([]);
        setUrlMediaList([]);
        setMediaUrl("");
        setShowMediaInput(false);
        setShowTopicTags(false);

        if (onPostCreated) {
          const newPost = {
            ...response.data.post,
            author: {
              _id: user.id || user._id,
              username: user.username,
              avatar: profile?.avatar,
              displayName: profile?.displayName
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
        err.response?.data?.message || err.message || "Failed to create post. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const totalMediaCount = selectedFiles.length + urlMediaList.length;

  return (
    <div className="composer-card">
      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
        aria-label="Upload photo or video"
      />

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

        {/* Render Attached Local & Remote Media Previews */}
        {totalMediaCount > 0 && (
          <div className="composer-media-gallery">
            {/* Local Device Previews */}
            {selectedFiles.map((m, idx) => (
              <div key={`local-${idx}`} className="composer-media-item">
                {m.type === "IMAGE" ? (
                  <img src={m.previewUrl} alt="Selected preview" />
                ) : (
                  <video src={m.previewUrl} controls />
                )}
                <div className="composer-media-badge">{m.size}</div>
                <button
                  type="button"
                  className="composer-media-remove-btn"
                  onClick={() => handleRemoveFile(idx)}
                  title="Remove media"
                  aria-label="Remove attached file"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}

            {/* Remote URL Previews */}
            {urlMediaList.map((m, idx) => (
              <div key={`url-${idx}`} className="composer-media-item">
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
                  type="button"
                  className="composer-media-remove-btn"
                  onClick={() => handleRemoveUrlMedia(idx)}
                  title="Remove media"
                  aria-label="Remove attached media"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Optional Direct URL Input Box */}
        {showMediaInput && (
          <div className="composer-media-input-bar">
            <select
              className="composer-media-type-select"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              aria-label="Media Type"
            >
              <option value="IMAGE">📷 Image URL</option>
              <option value="VIDEO">🎬 Video URL</option>
            </select>

            <input
              type="url"
              placeholder={`Paste direct ${mediaType.toLowerCase()} link (https://...)...`}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddUrlMedia();
                }
              }}
              aria-label="Media direct URL"
            />

            <button
              type="button"
              className="composer-submit-btn"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={handleAddUrlMedia}
            >
              Attach
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

        {/* Quick Tag Selector Bar */}
        {showTopicTags && (
          <div className="composer-tags-bar">
            {trendingTags.length > 0 ? (
              <>
                <span className="tags-label">Trending topics:</span>
                {trendingTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="tag-pill-btn"
                    onClick={() => handleInsertTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </>
            ) : (
              <span className="tags-label" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                No active trends yet. Type <strong style={{ color: "#38bdf8" }}>#yourtopic</strong> in your post to start one!
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="composer-footer">
          <div className="composer-actions">
            {/* Native Device Photo / Video Action */}
            <button
              type="button"
              className={`composer-tool-btn ${selectedFiles.length > 0 ? "active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              title="Upload Photo or Video from device"
              aria-label="Upload Photo or Video"
            >
              <ImageIcon size={18} />
              <span>Photo / Video</span>
            </button>

            {/* Poll Action */}
            <button
              type="button"
              className="composer-tool-btn"
              onClick={handlePollPrompt}
              title="Create a quick poll"
              aria-label="Create Poll"
            >
              <span>📊</span>
              <span>Poll</span>
            </button>

            {/* Ask Action */}
            <button
              type="button"
              className="composer-tool-btn"
              onClick={handleAskQuestion}
              title="Ask the community"
              aria-label="Ask Question"
            >
              <span>❓</span>
              <span>Ask</span>
            </button>

            {/* Topics Action */}
            <button
              type="button"
              className={`composer-tool-btn ${showTopicTags ? "active" : ""}`}
              onClick={() => setShowTopicTags((prev) => !prev)}
              title="Tag a mood or topic"
              aria-label="Topics"
            >
              <SparklesIcon size={16} />
              <span>Topics</span>
            </button>

            {/* Audience Visibility Selector */}
            <select
              className="composer-visibility-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              aria-label="Post audience visibility"
            >
              <option value="PUBLIC">🌐 Public</option>
              <option value="FOLLOWERS">👥 Followers</option>
              <option value="PRIVATE">🔒 Private</option>
            </select>
          </div>

          {/* Right side: Character counter + Post button */}
          <div className="composer-submit-group">
            {content.length > 0 && (
              <span className="composer-char-count">
                {5000 - content.length}
              </span>
            )}

            <button
              className="composer-submit-btn"
              disabled={submitting || (!content.trim() && totalMediaCount === 0)}
              onClick={handleSubmit}
              aria-label="Publish Post"
            >
              {submitting ? (
                <>
                  <LoaderIcon size={16} />
                  <span>{uploadStatus || "Posting..."}</span>
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