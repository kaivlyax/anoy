import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { followApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { XIcon, LoaderIcon, UsersIcon } from "./Icons";

function FollowListModal({ isOpen, onClose, username, type = "followers" }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStatuses, setFollowStatuses] = useState({});
  const [processingUser, setProcessingUser] = useState(null);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !username) return;

    let isMounted = true;
    const fetchList = async () => {
      try {
        setLoading(true);
        const fetcher =
          type === "followers"
            ? followApi.getFollowers(username)
            : followApi.getFollowing(username);

        const response = await fetcher;

        if (isMounted && response.data.success) {
          const items =
            type === "followers"
              ? response.data.followers || []
              : response.data.following || [];
          setList(items);

          items.forEach(async (item) => {
            const u = type === "followers" ? item.follower : item.following;
            if (u?.username && u.username !== user?.username) {
              try {
                const stRes = await followApi.getFollowStatus(u.username);
                if (isMounted && stRes.data.success) {
                  setFollowStatuses((prev) => ({
                    ...prev,
                    [u.username]: stRes.data.relationship
                  }));
                }
              } catch {
                // ignore
              }
            }
          });
        }
      } catch (err) {
        console.warn("Failed to load follow list", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchList();
    return () => {
      isMounted = false;
    };
  }, [isOpen, username, type, user?.username]);

  if (!isOpen) return null;

  const handleFollowToggle = async (targetUsername) => {
    if (processingUser) return;
    setProcessingUser(targetUsername);

    const currentStatus = followStatuses[targetUsername] || "NOT_FOLLOWING";

    if (currentStatus === "FOLLOWING" || currentStatus === "PENDING") {
      try {
        const res = await followApi.unfollowUser(targetUsername);
        if (res.data.success) {
          setFollowStatuses((prev) => ({
            ...prev,
            [targetUsername]: "NOT_FOLLOWING"
          }));
          addToast(`Unfollowed @${targetUsername}`, "info");
        }
      } catch (err) {
        addToast(err.response?.data?.message || "Failed to unfollow", "error");
      } finally {
        setProcessingUser(null);
      }
    } else {
      try {
        const res = await followApi.followUser(targetUsername);
        if (res.data.success) {
          const newStatus =
            res.data.status === "PENDING" ? "PENDING" : "FOLLOWING";
          setFollowStatuses((prev) => ({
            ...prev,
            [targetUsername]: newStatus
          }));
          addToast(
            newStatus === "PENDING"
              ? `Follow request sent to @${targetUsername}`
              : `Following @${targetUsername}`,
            "success"
          );
        }
      } catch (err) {
        addToast(err.response?.data?.message || "Failed to follow", "error");
      } finally {
        setProcessingUser(null);
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-list-modal-title"
    >
      <div
        className="modal-container"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <h2
            id="follow-list-modal-title"
            className="modal-title"
            style={{ textTransform: "capitalize" }}
          >
            {type}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "12px 18px" }}>
          {loading ? (
            <div className="feed-loading-container">
              <LoaderIcon size={28} />
            </div>
          ) : list.length === 0 ? (
            <div className="empty-feed" style={{ padding: "30px 10px" }}>
              <div className="empty-feed-icon">
                <UsersIcon size={24} />
              </div>
              <h3 className="empty-feed-title" style={{ fontSize: 16 }}>
                No {type} yet
              </h3>
            </div>
          ) : (
            <div className="discover-user-list">
              {list.map((item) => {
                const target =
                  type === "followers" ? item.follower : item.following;
                if (!target) return null;

                const isSelf = target.username === user?.username;
                const status = followStatuses[target.username] || "NOT_FOLLOWING";
                const isFollowing = status === "FOLLOWING";
                const isPending = status === "PENDING";
                const isBusy = processingUser === target.username;

                return (
                  <div
                    key={item._id || target._id}
                    className="discover-user-item"
                    style={{ padding: "8px 0" }}
                  >
                    <Link
                      to={`/profile/${target.username}`}
                      className="discover-user-info"
                      onClick={onClose}
                    >
                      <div className="discover-user-avatar">
                        {target.avatar ? (
                          <img
                            src={target.avatar}
                            alt={target.username}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              objectFit: "cover"
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          target.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="discover-user-names">
                        <span className="discover-name">
                          {target.displayName || target.username}
                        </span>
                        <span className="discover-handle">
                          @{target.username}
                        </span>
                      </div>
                    </Link>

                    {!isSelf && (
                      <button
                        className={`follow-toggle-btn ${
                          isFollowing
                            ? "following"
                            : isPending
                            ? "requested"
                            : "follow"
                        }`}
                        disabled={isBusy}
                        onClick={() => handleFollowToggle(target.username)}
                      >
                        {isBusy ? (
                          <LoaderIcon size={14} />
                        ) : isFollowing ? (
                          "Following"
                        ) : isPending ? (
                          "Pending"
                        ) : (
                          "Follow"
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowListModal;
