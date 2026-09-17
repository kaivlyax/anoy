import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userApi, followApi, postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { SearchIcon, LoaderIcon, SparklesIcon } from "./Icons";
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

  // Real Dynamic Trending Topics from ANOY Database
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Fetch real trending topics from database
  useEffect(() => {
    let isMounted = true;
    const fetchTrending = async () => {
      try {
        setTrendingLoading(true);
        const res = await postApi.getTrendingTopics(5);
        if (isMounted && res.data.success) {
          setTrendingTopics(res.data.trending || []);
        }
      } catch (err) {
        console.warn("Failed to fetch trending topics:", err);
      } finally {
        if (isMounted) setTrendingLoading(false);
      }
    };

    fetchTrending();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch real discoverable users
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
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&tab=posts`);
    }
  };

  const handleTrendingClick = (tag) => {
    navigate(`/search?q=${encodeURIComponent(tag)}&tab=posts`);
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
    <aside className="right-sidebar" aria-label="Discovery and Trends Sidebar">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="search-box-container-modern glass-panel">
        <span className="search-icon-adornment">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          className="search-box-input-modern"
          placeholder="Search students, topics, Bharat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Quick search query"
        />
      </form>

      {/* Real Dynamic Trending in India Widget */}
      <div className="widget-card-modern glass-panel">
        <div className="widget-header-row">
          <h3 className="widget-title-modern">Trending in India</h3>
          <span className="widget-badge-flag">🇮🇳 Live</span>
        </div>

        {trendingLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "6px 8px"
                }}
              >
                <div className="skeleton-box" style={{ width: 80, height: 10 }} />
                <div className="skeleton-box" style={{ width: 140, height: 14 }} />
                <div className="skeleton-box" style={{ width: 60, height: 10 }} />
              </div>
            ))}
          </div>
        ) : trendingTopics.length === 0 ? (
          <div className="trending-empty-state" style={{ padding: "8px 4px" }}>
            <p style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.4 }}>
              Trending will appear as the ANOY community grows.
            </p>
            <p style={{ color: "#FF9933", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
              Start a trend with a #hashtag in your post!
            </p>
          </div>
        ) : (
          <div className="trending-topics-list">
            {trendingTopics.map((topic, idx) => {
              const displayTag = topic.tag || topic.topic;
              const countText = `${topic.postCount} ${
                topic.postCount === 1 ? "post" : "posts"
              }`;
              const engagementText =
                topic.engagement > 0
                  ? ` • ${topic.engagement} interactions`
                  : "";

              return (
                <div
                  key={idx}
                  className="trending-topic-item"
                  onClick={() => handleTrendingClick(displayTag)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTrendingClick(displayTag);
                  }}
                  title={`View posts for ${displayTag}`}
                >
                  <div className="trending-meta">
                    <span className="trending-category">Trending on ANOY</span>
                    <span className="trending-tag">{displayTag}</span>
                  </div>
                  <span className="trending-count">{countText}{engagementText}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested Students / Who to follow */}
      <div className="widget-card-modern glass-panel">
        <h3 className="widget-title-modern">Who to follow</h3>

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
            No new suggestions right now.
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

      {/* Different Stories. One India. Inspiration Card */}
      <div className="bharat-quote-card glass-panel">
        <div className="bharat-quote-header">
          <SparklesIcon size={16} style={{ color: "#FF9933" }} />
          <span>ANOY Inspiration</span>
        </div>
        <p className="bharat-quote-text">
          &ldquo;Different Stories. Different Campuses. One India.&rdquo;
        </p>
        <div className="bharat-quote-sub">
          Connecting universities from Kashmir to Kanyakumari.
        </div>
      </div>

      {/* Mini Footer */}
      <div className="right-sidebar-footer">
        <span>© 2026 ANOY</span>
        <span>•</span>
        <span>Apna Social Space</span>
        <span>•</span>
        <Link to="/search">Search</Link>
        <span>•</span>
        <Link to="/communities">Communities</Link>
        <span>•</span>
        <Link to="/ai">ANOY AI</Link>
      </div>
    </aside>
  );
}

export default RightSidebar;
