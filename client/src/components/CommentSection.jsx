import { useState, useEffect } from "react";
import { commentApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SendIcon, TrashIcon, LoaderIcon } from "./Icons";

function CommentSection({ postId, onCommentAdded, onCommentRemoved }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await commentApi.getComments(postId);
        if (isMounted && response.data.success) {
          setComments(response.data.comments || []);
        }
      } catch (err) {
        console.warn("Failed to load comments", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComments();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleCreateComment = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting) return;

    try {
      setSubmitting(true);
      const response = await commentApi.createComment(postId, {
        content: content.trim()
      });

      if (response.data.success) {
        const newComment = {
          ...response.data.comment,
          author: {
            _id: user.id || user._id,
            username: user.username
          }
        };

        setComments((prev) => [newComment, ...prev]);
        setContent("");
        if (onCommentAdded) onCommentAdded();
        addToast("Comment posted", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to post comment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (deletingId) return;
    try {
      setDeletingId(commentId);
      const response = await commentApi.deleteComment(commentId);
      if (response.data.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        if (onCommentRemoved) onCommentRemoved();
        addToast("Comment deleted", "info");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete comment", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const formatCommentTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="comments-section">
      {/* Add Comment Input */}
      <form onSubmit={handleCreateComment} className="comment-input-box">
        <div className="comment-avatar">
          {user?.username?.charAt(0).toUpperCase()}
        </div>

        <div className="comment-form">
          <input
            type="text"
            placeholder="Post your reply... (Press Enter)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCreateComment();
              }
            }}
            maxLength={500}
            aria-label="Comment text"
          />
          <button
            type="submit"
            className="comment-send-btn"
            disabled={submitting || !content.trim()}
            aria-label="Submit comment"
          >
            {submitting ? <LoaderIcon size={14} /> : <SendIcon size={14} />}
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
          <LoaderIcon size={20} />
        </div>
      ) : comments.length === 0 ? (
        <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 8 }}>
          No comments yet. Be the first to reply!
        </p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => {
            const isMyComment =
              comment.author?._id === (user?.id || user?._id) ||
              comment.author?.username === user?.username;

            return (
              <div key={comment._id} className="comment-item">
                <div className="comment-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                  {(comment.author?.username || "U").charAt(0).toUpperCase()}
                </div>

                <div className="comment-bubble">
                  <div className="comment-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="comment-author">
                        @{comment.author?.username || "user"}
                      </span>
                      <span className="comment-time">
                        {formatCommentTime(comment.createdAt)}
                      </span>
                    </div>

                    {isMyComment && (
                      <button
                        className="comment-delete-btn"
                        onClick={() => handleDeleteComment(comment._id)}
                        disabled={deletingId === comment._id}
                        title="Delete comment"
                        aria-label="Delete comment"
                      >
                        {deletingId === comment._id ? (
                          <LoaderIcon size={12} />
                        ) : (
                          <TrashIcon size={13} />
                        )}
                      </button>
                    )}
                  </div>

                  <p className="comment-body">{comment.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CommentSection;
