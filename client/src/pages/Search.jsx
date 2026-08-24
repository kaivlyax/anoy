import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { userApi, followApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  SearchIcon,
  LoaderIcon,
  UsersIcon,
  SparklesIcon,
  XIcon,
  AlertCircleIcon
} from "../components/Icons";

function Search() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam);
  const [results, setResults] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followStatuses, setFollowStatuses] = useState({});
  const [processingUser, setProcessingUser] = useState(null);

  // Debounce query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedQuery(trimmed);
      if (trimmed) {
        setSearchParams({ q: trimmed });
      } else {
        setSearchParams({});
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

  // Fetch follow status helper
  const fetchStatusForUsers = useCallback(
    (usersList) => {
      usersList.forEach(async (u) => {
        if (u.username && u.username !== user?.username) {
          try {
            const stRes = await followApi.getFollowStatus(u.username);
            if (stRes.data.success) {
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
    },
    [user?.username]
  );

  // Perform search or discover
  useEffect(() => {
    let isMounted = true;

    const performSearch = async () => {
      if (!debouncedQuery) {
        try {
          setLoading(true);
          setError("");
          const response = await userApi.discoverUsers(15);
          if (isMounted && response.data.success) {
            const users = response.data.users || [];
            setSuggestedUsers(users);
            setResults([]);
            fetchStatusForUsers(users);
          }
        } catch (err) {
          console.warn("Discovery fetch failed", err);
        } finally {
          if (isMounted) setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await userApi.searchUsers(debouncedQuery);
        if (isMounted && response.data.success) {
          const users = response.data.users || [];
          setResults(users);
          fetchStatusForUsers(users);
        }
      } catch (err) {
        console.error("Search error", err);
        if (isMounted) {
          setError(
            err.response?.data?.message || "Error searching for users"
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    performSearch();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, fetchStatusForUsers]);

  // Handle follow / unfollow toggle
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

  const displayedList = debouncedQuery ? results : suggestedUsers;

  return (
    <div className="main-feed-column">
      {/* Sticky Header with Search Bar */}
      <header className="sticky-header" style={{ padding: "14px 20px" }}>
        <div className="search-box-container">
          <span className="search-icon-adornment">
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            className="search-box-input"
            style={{ padding: "12px 42px 12px 44px", fontSize: 15 }}
            placeholder="Search by name, @username, skill, or interest..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            aria-label="Search users on ANOY"
          />
          {searchTerm && (
            <button
              type="button"
              className="toast-close-btn"
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)"
              }}
              onClick={() => setSearchTerm("")}
              aria-label="Clear search input"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
      </header>

      <main>
        {loading ? (
          <div>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="search-user-card">
                <div
                  className="skeleton-box"
                  style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="skeleton-box" style={{ width: "35%", height: 16 }} />
                  <div className="skeleton-box" style={{ width: "20%", height: 12 }} />
                  <div className="skeleton-box" style={{ width: "70%", height: 14 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-feed">
            <div className="empty-feed-icon" style={{ color: "#ef4444" }}>
              <AlertCircleIcon size={30} />
            </div>
            <h3 className="empty-feed-title">Search Error</h3>
            <p className="empty-feed-subtitle">{error}</p>
          </div>
        ) : debouncedQuery && displayedList.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-icon">
              <UsersIcon size={30} />
            </div>
            <h3 className="empty-feed-title">
              No results for "{debouncedQuery}"
            </h3>
            <p className="empty-feed-subtitle">
              Try searching for a different username, topic, skill, or interest.
            </p>
          </div>
        ) : (
          <div>
            {!debouncedQuery && (
              <div
                style={{
                  padding: "16px 20px 8px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--text-muted)",
                  fontSize: 14,
                  fontWeight: 700
                }}
              >
                <SparklesIcon size={16} />
                <span>Discover People on ANOY</span>
              </div>
            )}

            <div className="search-results-list">
              {displayedList.map((target) => {
                const isSelf = target.username === user?.username;
                const status =
                  followStatuses[target.username] || "NOT_FOLLOWING";
                const isFollowing = status === "FOLLOWING";
                const isPending = status === "PENDING";
                const isBusy = processingUser === target.username;

                return (
                  <div key={target._id || target.username} className="search-user-card">
                    <Link
                      to={`/profile/${target.username}`}
                      className="search-user-avatar-link"
                      aria-label={`View @${target.username}'s profile`}
                    >
                      <div className="discover-user-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
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
                          (target.displayName || target.username || "U")
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>
                    </Link>

                    <div className="search-user-info">
                      <div className="search-user-header">
                        <Link
                          to={`/profile/${target.username}`}
                          className="search-user-name"
                        >
                          {target.displayName || target.username}
                        </Link>
                        <span className="search-user-handle">
                          @{target.username}
                        </span>
                      </div>

                      {target.bio && (
                        <p className="search-user-bio">{target.bio}</p>
                      )}

                      {/* Skills and Interests */}
                      {((target.skills && target.skills.length > 0) ||
                        (target.interests && target.interests.length > 0)) && (
                        <div className="search-tags-row">
                          {target.skills?.slice(0, 3).map((skill, i) => (
                            <span key={i} className="skill-chip" style={{ fontSize: 11, padding: "2px 8px" }}>
                              {skill}
                            </span>
                          ))}
                          {target.interests?.slice(0, 2).map((interest, i) => (
                            <span key={i} className="interest-chip" style={{ fontSize: 11, padding: "2px 8px" }}>
                              #{interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

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
                        aria-label={`${
                          isFollowing
                            ? "Unfollow"
                            : isPending
                            ? "Cancel follow request for"
                            : "Follow"
                        } @${target.username}`}
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
          </div>
        )}
      </main>
    </div>
  );
}

export default Search;
