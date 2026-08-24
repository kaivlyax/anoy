import { useState } from "react";
import { Link } from "react-router-dom";
import { postApi, likeApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  HeartIcon,
  MessageCircleIcon,
  ShareIcon,
  TrashIcon,
  UsersIcon,
  LockIcon
} from "./Icons";
import CommentSection from "./CommentSection";

function PostCard({ post, onPostDeleted }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [isLiked, setIsLiked] = useState(Boolean(post.isLiked));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const authorUsername = post.author?.username || "user";
  const isMyPost =
    post.author?._id === (user?.id || user?._id) ||
    post.author?.username === user?.username;

  // Relative timestamp calculation
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  };

  // Like / Unlike action with optimistic UI
  const handleToggleLike = async () => {
    if (isLiking) return;

    const previousLiked = isLiked;
    const previousCount = likeCount;

    setIsLiked(!previousLiked);
    setLikeCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);
    setIsLiking(true);

    try {
      if (previousLiked) {
        await likeApi.unlikePost(post._id);
      } else {
        await likeApi.likePost(post._id);
      }
    } catch (err) {
      // Revert on failure
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      addToast(err.response?.data?.message || "Like action failed", "error");
    } finally {
      setIsLiking(false);
    }
  };

  // Delete post action
  const handleDeletePost = async () => {
    if (isDeleting) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      setIsDeleting(true);
      const response = await postApi.deletePost(post._id);
      if (response.data.success) {
        addToast("Post deleted", "info");
        if (onPostDeleted) {
          onPostDeleted(post._id);
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete post", "error");
      setIsDeleting(false);
    }
  };

  // Share post action (copy link)
  const handleShare = () => {
    const postUrl = `${window.location.origin}/post/${post._id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(postUrl);
      addToast("Post link copied to clipboard!", "info");
    } else {
      addToast(postUrl, "info");
    }
  };

  return (
    <article className="post-card">
      {/* Author Avatar Link */}
      <Link
        to={`/profile/${authorUsername}`}
        className="post-avatar"
        aria-label={`View ${authorUsername}'s profile`}
      >
        {post.author?.avatar ? (
          <img
            src={post.author.avatar}
            alt={authorUsername}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          authorUsername.charAt(0).toUpperCase()
        )}
      </Link>

      <div className="post-main">
        {/* Header Metadata */}
        <div className="post-header">
          <div className="post-author-meta">
            <Link to={`/profile/${authorUsername}`} className="post-author-name">
              {post.author?.displayName || authorUsername}
            </Link>
            <span className="post-author-handle">@{authorUsername}</span>
            <span className="post-dot-separator">·</span>
            <span className="post-time">{formatTime(post.createdAt)}</span>

            {post.visibility === "FOLLOWERS" && (
              <span className="post-visibility-badge" title="Followers only">
                <UsersIcon size={12} />
              </span>
            )}
            {post.visibility === "PRIVATE" && (
              <span className="post-visibility-badge" title="Private post">
                <LockIcon size={12} />
              </span>
            )}
          </div>

          {isMyPost && (
            <button
              className="post-delete-btn"
              onClick={handleDeletePost}
              disabled={isDeleting}
              title="Delete post"
              aria-label="Delete this post"
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>

        {/* Content Body */}
        {post.content && <div className="post-content">{post.content}</div>}

        {/* Media Attachments */}
        {post.media && post.media.length > 0 && (
          <div className="post-media-container">
            {post.media.map((m, idx) => (
              <div key={idx}>
                {m.type === "IMAGE" ? (
                  <img
                    src={m.url}
                    alt="Post attachment"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <video src={m.url} controls preload="metadata" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Interaction Action Buttons */}
        <div className="post-actions">
          {/* Like Button */}
          <button
            className={`post-action-btn ${isLiked ? "liked" : ""}`}
            onClick={handleToggleLike}
            disabled={isLiking}
            title={isLiked ? "Unlike post" : "Like post"}
            aria-label={isLiked ? "Unlike post" : "Like post"}
          >
            <HeartIcon size={18} filled={isLiked} />
            <span>{likeCount > 0 ? likeCount : ""}</span>
          </button>

          {/* Comment Toggle Button */}
          <button
            className="post-action-btn"
            onClick={() => setShowComments((prev) => !prev)}
            title="Reply to post"
            aria-label="Reply to post"
          >
            <MessageCircleIcon size={18} />
            <span>{commentCount > 0 ? commentCount : ""}</span>
          </button>

          {/* Share Button */}
          <button
            className="post-action-btn"
            onClick={handleShare}
            title="Share post"
            aria-label="Share post link"
          >
            <ShareIcon size={18} />
          </button>
        </div>

        {/* Expandable Comments Drawer */}
        {showComments && (
          <CommentSection
            postId={post._id}
            onCommentAdded={() => setCommentCount((prev) => prev + 1)}
            onCommentRemoved={() =>
              setCommentCount((prev) => Math.max(0, prev - 1))
            }
          />
        )}
      </div>
    </article>
  );
}

export default PostCard;
