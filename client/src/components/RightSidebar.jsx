import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userApi, followApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { SearchIcon, LoaderIcon } from "./Icons";
import { useToast } from "../context/ToastContext";

function RightSidebar() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStatuses, setFollowStatuses] = useState({});
  const [processingUser, setProcessingUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDiscover = async () => {
      try {
        setLoading(true);
        const response = await userApi.discoverUsers(5);
        if (isMounted && response.data.success && response.data.users) {
          const filtered = response.data.users.filter(
            (u) => u.username !== user?.username
          );
          setDiscoverUsers(filtered);

          filtered.forEach(async (u) => {
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
          });
        }
      } catch (err) {
        console.warn("Failed to load suggested users", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (user) {
      fetchDiscover();
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
    <aside className="right-sidebar">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="search-box-container">
        <span className="search-icon-adornment">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          className="search-box-input"
          placeholder="Search ANOY..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Quick search query"
        />
      </form>

      {/* Suggested Users Widget */}
      <div className="widget-card">
        <h3 className="widget-title">Who to follow</h3>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    className="skeleton-box"
                    style={{ width: 38, height: 38, borderRadius: "50%" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4
                    }}
                  >
                    <div
                      className="skeleton-box"
                      style={{ width: 80, height: 12 }}
                    />
                    <div
                      className="skeleton-box"
                      style={{ width: 50, height: 10 }}
                    />
                  </div>
                </div>
                <div
                  className="skeleton-box"
                  style={{ width: 64, height: 28, borderRadius: 14 }}
                />
              </div>
            ))}
          </div>
        ) : discoverUsers.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
            No new user suggestions right now.
          </p>
        ) : (
          <div className="discover-user-list">
            {discoverUsers.map((u) => {
              const status = followStatuses[u.username] || "NOT_FOLLOWING";
              const isFollowing = status === "FOLLOWING";
              const isPending = status === "PENDING";
              const isBusy = processingUser === u.username;

              return (
                <div key={u._id || u.username} className="discover-user-item">
                  <Link
                    to={`/profile/${u.username}`}
                    className="discover-user-info"
                    aria-label={`View @${u.username}'s profile`}
                  >
                    <div className="discover-user-avatar">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.username}
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
                        (u.displayName || u.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="discover-user-names">
                      <span className="discover-name">
                        {u.displayName || u.username}
                      </span>
                      <span className="discover-handle">@{u.username}</span>
                    </div>
                  </Link>

                  <button
                    className={`follow-toggle-btn ${
                      isFollowing
                        ? "following"
                        : isPending
                        ? "requested"
                        : "follow"
                    }`}
                    disabled={isBusy}
                    onClick={() => handleFollowToggle(u.username)}
                    aria-label={`${
                      isFollowing ? "Unfollow" : isPending ? "Pending" : "Follow"
                    } @${u.username}`}
                  >
                    {isBusy ? (
                      <LoaderIcon size={12} />
                    ) : isFollowing ? (
                      "Following"
                    ) : isPending ? (
                      "Pending"
                    ) : (
                      "Follow"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mini Footer */}
      <div
        style={{
          padding: "0 8px",
          color: "var(--text-dim)",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10
        }}
      >
        <span>© 2026 ANOY</span>
        <span>Privacy</span>
        <span>Terms</span>
        <span>Explore</span>
      </div>
    </aside>
  );
}

export default RightSidebar;
