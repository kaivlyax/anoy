import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { userApi, followApi, searchApi, communityApi, postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AvatarFrame from "../components/AvatarFrame";
import ProBadge from "../components/ProBadge";
import {
  SearchIcon,
  LoaderIcon,
  UsersIcon,
  SparklesIcon,
  XIcon,
  AlertCircleIcon,
  MessageCircleIcon,
  HeartIcon,
  LockIcon,
  ClockIcon,
  HashIcon,
  CompassIcon
} from "../components/Icons";

const RECENT_SEARCHES_KEY = "anoy_recent_searches";

function Search() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get("q") || "";
  const tabParam = searchParams.get("tab") || "people"; // 'people' | 'communities' | 'posts'

  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState(tabParam);
  const [trendingTags, setTrendingTags] = useState([]);

  // Suggestions & Dropdown State
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [livePreview, setLivePreview] = useState({ users: [], communities: [], posts: [] });
  const [liveLoading, setLiveLoading] = useState(false);

  // Full Tab Results
  const [peopleResults, setPeopleResults] = useState([]);
  const [communityResults, setCommunityResults] = useState([]);
  const [postResults, setPostResults] = useState([]);

  // Initial Discovery State Data
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [popularCommunities, setPopularCommunities] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followStatuses, setFollowStatuses] = useState({});
  const [processingUser, setProcessingUser] = useState(null);

  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentSearch = useCallback((term) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== cleaned.toLowerCase());
      const updated = [cleaned, ...filtered].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = (e, termToRemove) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== termToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const clearAllRecentSearches = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync state with URL params
  useEffect(() => {
    if (queryParam !== searchTerm) {
      setSearchTerm(queryParam);
      setDebouncedQuery(queryParam);
    }
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [queryParam, tabParam]);

  // Debounce search term to update URL & trigger search
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      setDebouncedQuery(trimmed);

      const params = {};
      if (trimmed) params.q = trimmed;
      if (activeTab && activeTab !== "people") params.tab = activeTab;
      setSearchParams(params, { replace: true });

      if (trimmed) {
        saveRecentSearch(trimmed);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, setSearchParams, saveRecentSearch]);

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

  // Load initial discovery recommendations if no query
  useEffect(() => {
    let isMounted = true;
    if (debouncedQuery) return;

    const fetchInitialDiscover = async () => {
      try {
        setLoadingInitial(true);
        const [usersRes, commsRes, trendRes] = await Promise.allSettled([
          userApi.discoverUsers(12),
          communityApi.getCommunities({ limit: 6 }),
          postApi.getTrendingTopics(8)
        ]);

        if (isMounted) {
          if (usersRes.status === "fulfilled" && usersRes.value.data?.success) {
            const uList = usersRes.value.data.users || [];
            setSuggestedUsers(uList);
            fetchStatusForUsers(uList);
          }
          if (commsRes.status === "fulfilled" && commsRes.value.data?.success) {
            setPopularCommunities(commsRes.value.data.communities || []);
          }
          if (trendRes.status === "fulfilled" && trendRes.value.data?.success) {
            const tList = (trendRes.value.data.trending || []).map((t) => t.tag || t.topic);
            setTrendingTags(tList);
          }
        }
      } catch (err) {
        console.warn("Error fetching discovery recommendations:", err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    fetchInitialDiscover();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, fetchStatusForUsers]);

  // Live Autocomplete / Preview (fast unified search)
  useEffect(() => {
    let isMounted = true;
    const trimmed = searchTerm.trim();
    if (!trimmed || !isFocused) {
      setLivePreview({ users: [], communities: [], posts: [] });
      setLiveLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLiveLoading(true);
        const res = await searchApi.search(trimmed, "all", 4);
        if (isMounted && res.data.success) {
          setLivePreview({
            users: res.data.users || [],
            communities: res.data.communities || [],
            posts: res.data.posts || []
          });
        }
      } catch (err) {
        console.warn("Live preview search error:", err);
      } finally {
        if (isMounted) setLiveLoading(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm, isFocused]);

  // Full Tab-Based Search
  useEffect(() => {
    let isMounted = true;
    if (!debouncedQuery) {
      setPeopleResults([]);
      setCommunityResults([]);
      setPostResults([]);
      return;
    }

    const performFullSearch = async () => {
      try {
        setLoading(true);
        setError("");

        if (activeTab === "people") {
          const res = await searchApi.searchUsers(debouncedQuery, 30);
          if (isMounted && res.data.success) {
            const list = res.data.users || [];
            setPeopleResults(list);
            fetchStatusForUsers(list);
          }
        } else if (activeTab === "communities") {
          const res = await searchApi.searchCommunities(debouncedQuery, 30);
          if (isMounted && res.data.success) {
            setCommunityResults(res.data.communities || []);
          }
        } else if (activeTab === "posts") {
          const res = await searchApi.searchPosts(debouncedQuery, 30);
          if (isMounted && res.data.success) {
            setPostResults(res.data.posts || []);
          }
        }
      } catch (err) {
        console.error("Search execution error:", err);
        if (isMounted) {
          setError(err.response?.data?.message || "Failed to load search results. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    performFullSearch();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, activeTab, fetchStatusForUsers]);

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
          const newStatus = res.data.status === "PENDING" ? "PENDING" : "FOLLOWING";
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

  const handleSelectSearch = (term, targetTab = null) => {
    setSearchTerm(term);
    setDebouncedQuery(term);
    if (targetTab) setActiveTab(targetTab);
    setIsFocused(false);
    saveRecentSearch(term);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      setIsFocused(false);
      if (searchTerm.trim()) {
        saveRecentSearch(searchTerm);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const hasLiveResults =
    livePreview.users.length > 0 ||
    livePreview.communities.length > 0 ||
    livePreview.posts.length > 0;

  return (
    <div className="search-page-container">
      {/* Search Header Banner */}
      <header className="search-hero-header">
        <div className="search-hero-text">
          <div className="search-hero-badge">
            <CompassIcon size={16} className="search-hero-badge-icon" />
            <span>DISCOVER ANOY</span>
          </div>
          <h1 className="search-hero-title">Search ANOY</h1>
          <p className="search-hero-subtitle">
            Find students, communities, discussions, and projects across campus.
          </p>
        </div>

        {/* Search Input Bar & Dropdown */}
        <div className="search-bar-unified-container" ref={searchContainerRef}>
          <div className={`search-input-glass-box ${isFocused ? "focused" : ""}`}>
            <span className="search-glass-icon">
              {liveLoading ? <LoaderIcon size={18} className="animate-spin text-primary" /> : <SearchIcon size={18} />}
            </span>

            <input
              ref={inputRef}
              type="text"
              className="search-glass-input"
              placeholder="Search people, communities, or posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              aria-label="Search people, communities, or posts on ANOY"
              autoComplete="off"
            />

            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchTerm("");
                  setDebouncedQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search text"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete / Suggestions Dropdown */}
          {isFocused && (
            <div className="search-dropdown-menu">
              {/* CASE 1: Query is empty -> show Recent Searches & Trending */}
              {!searchTerm.trim() ? (
                <div className="search-suggestions-panel">
                  {recentSearches.length > 0 && (
                    <div className="search-suggestion-section">
                      <div className="suggestion-header-row">
                        <span className="suggestion-label">
                          <ClockIcon size={14} /> Recent Searches
                        </span>
                        <button
                          type="button"
                          className="btn-clear-recents"
                          onClick={clearAllRecentSearches}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="recent-chips-list">
                        {recentSearches.map((term, i) => (
                          <div
                            key={i}
                            className="recent-chip"
                            onClick={() => handleSelectSearch(term)}
                            role="button"
                            tabIndex={0}
                          >
                            <SearchIcon size={13} className="chip-icon" />
                            <span className="chip-text">{term}</span>
                            <button
                              type="button"
                              className="chip-remove-btn"
                              onClick={(e) => removeRecentSearch(e, term)}
                              aria-label={`Remove ${term}`}
                            >
                              <XIcon size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {trendingTags.length > 0 && (
                    <div className="search-suggestion-section">
                      <span className="suggestion-label">
                        <SparklesIcon size={14} /> Trending on ANOY
                      </span>
                      <div className="trending-tags-grid">
                        {trendingTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="trending-tag-btn"
                            onClick={() => handleSelectSearch(tag, "posts")}
                          >
                            <HashIcon size={13} />
                            <span>{tag.replace(/^#/, "")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : liveLoading && !hasLiveResults ? (
                /* CASE 2: Loading live results */
                <div className="search-dropdown-loading">
                  <LoaderIcon size={20} />
                  <span>Searching for "{searchTerm}"...</span>
                </div>
              ) : hasLiveResults ? (
                /* CASE 3: Live preview dropdown with grouped results */
                <div className="search-live-results">
                  {/* People Preview */}
                  {livePreview.users.length > 0 && (
                    <div className="live-group">
                      <div className="live-group-header">PEOPLE</div>
                      {livePreview.users.map((u) => (
                        <div
                          key={u._id || u.username}
                          className="live-result-item"
                          onClick={() => {
                            setIsFocused(false);
                            navigate(`/profile/${u.username}`);
                          }}
                        >
                          <AvatarFrame decoration={u.avatarDecoration} size="sm">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.displayName} className="live-item-avatar" />
                            ) : (
                              <div className="live-item-avatar-fallback">
                                {(u.displayName || u.username || "U").charAt(0).toUpperCase()}
                              </div>
                            )}
                          </AvatarFrame>
                          <div className="live-item-text">
                            <div className="live-item-title-row">
                              <span className="live-item-name">{u.displayName || u.username}</span>
                              {u.isPro && <ProBadge size="sm" />}
                            </div>
                            <span className="live-item-sub">@{u.username}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Communities Preview */}
                  {livePreview.communities.length > 0 && (
                    <div className="live-group">
                      <div className="live-group-header">COMMUNITIES</div>
                      {livePreview.communities.map((c) => (
                        <div
                          key={c._id || c.slug}
                          className="live-result-item"
                          onClick={() => {
                            setIsFocused(false);
                            navigate(`/communities/${c.slug}`);
                          }}
                        >
                          <div className="live-item-comm-avatar">
                            {c.avatar ? (
                              <img src={c.avatar} alt={c.name} />
                            ) : (
                              <span>{c.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="live-item-text">
                            <div className="live-item-title-row">
                              <span className="live-item-name">{c.name}</span>
                              {c.isPrivate && <LockIcon size={11} className="text-danger" />}
                            </div>
                            <span className="live-item-sub">@{c.slug} • {c.memberCount} members</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Posts Preview */}
                  {livePreview.posts.length > 0 && (
                    <div className="live-group">
                      <div className="live-group-header">POSTS</div>
                      {livePreview.posts.map((p) => (
                        <div
                          key={p._id}
                          className="live-result-item"
                          onClick={() => {
                            setIsFocused(false);
                            setActiveTab("posts");
                            setDebouncedQuery(searchTerm);
                          }}
                        >
                          <MessageCircleIcon size={16} className="text-muted" />
                          <div className="live-item-text">
                            <span className="live-item-post-snippet">{p.content}</span>
                            <span className="live-item-sub">by @{p.author?.username || "student"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: View All Results */}
                  <div
                    className="live-dropdown-footer"
                    onClick={() => {
                      setIsFocused(false);
                      setDebouncedQuery(searchTerm);
                      saveRecentSearch(searchTerm);
                    }}
                  >
                    <span>View all results for "<strong>{searchTerm}</strong>"</span>
                    <span className="footer-arrow">→</span>
                  </div>
                </div>
              ) : (
                /* CASE 4: No live matches */
                <div className="search-dropdown-empty">
                  <p>Press Enter to search for "<strong>{searchTerm}</strong>"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Tab Pills */}
        <div className="search-nav-pills-row" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "people"}
            className={`search-pill-btn ${activeTab === "people" ? "active" : ""}`}
            onClick={() => setActiveTab("people")}
          >
            <span className="pill-icon">👤</span>
            <span>People</span>
            {debouncedQuery && peopleResults.length > 0 && (
              <span className="pill-badge">{peopleResults.length}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "communities"}
            className={`search-pill-btn ${activeTab === "communities" ? "active" : ""}`}
            onClick={() => setActiveTab("communities")}
          >
            <span className="pill-icon">👥</span>
            <span>Communities</span>
            {debouncedQuery && communityResults.length > 0 && (
              <span className="pill-badge">{communityResults.length}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "posts"}
            className={`search-pill-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <span className="pill-icon">💬</span>
            <span>Posts</span>
            {debouncedQuery && postResults.length > 0 && (
              <span className="pill-badge">{postResults.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Search Body */}
      <main className="search-results-main">
        {/* State 1: Loading */}
        {loading ? (
          <div className="search-loading-skeletons">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="search-skeleton-card">
                <div className="skeleton-avatar" />
                <div className="skeleton-content">
                  <div className="skeleton-line-title" />
                  <div className="skeleton-line-sub" />
                  <div className="skeleton-line-desc" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* State 2: Error */
          <div className="search-error-state">
            <div className="error-icon-circle">
              <AlertCircleIcon size={32} />
            </div>
            <h3 className="error-title">Search Encountered an Issue</h3>
            <p className="error-desc">{error}</p>
            <button
              type="button"
              className="btn-search-retry"
              onClick={() => setDebouncedQuery(searchTerm.trim())}
            >
              Try Again
            </button>
          </div>
        ) : !debouncedQuery ? (
          /* State 3: Initial Discovery View (No query typed yet) */
          <div className="search-initial-discovery">
            <div className="discovery-section-header">
              <SparklesIcon size={18} className="text-primary" />
              <h2>Explore Campus Highlights</h2>
            </div>

            {/* Quick Explore Tags from Real Trends */}
            {trendingTags.length > 0 && (
              <div className="discovery-tags-bar">
                {trendingTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="discovery-topic-pill"
                    onClick={() => handleSelectSearch(tag, "posts")}
                  >
                    #{tag.replace(/^#/, "")}
                  </button>
                ))}
              </div>
            )}

            {/* People you may know */}
            <div className="discovery-block">
              <div className="block-title-row">
                <h3>Students you may know</h3>
                <span className="block-subtitle">Connect with classmates and campus peers</span>
              </div>

              {loadingInitial ? (
                <div className="discovery-loading-spinner">
                  <LoaderIcon size={24} />
                  <span>Loading suggestions...</span>
                </div>
              ) : (
                <div className="discovery-people-grid">
                  {suggestedUsers.slice(0, 6).map((target) => {
                    const isSelf = target.username === user?.username;
                    const status = followStatuses[target.username] || "NOT_FOLLOWING";
                    const isFollowing = status === "FOLLOWING";
                    const isPending = status === "PENDING";
                    const isBusy = processingUser === target.username;

                    return (
                      <div key={target._id || target.username} className="discovery-person-card">
                        <Link to={`/profile/${target.username}`} className="person-avatar-wrapper">
                          <AvatarFrame decoration={target.avatarDecoration} size="md">
                            {target.avatar ? (
                              <img src={target.avatar} alt={target.displayName} className="person-avatar-img" />
                            ) : (
                              <div className="person-avatar-placeholder">
                                {(target.displayName || target.username || "U").charAt(0).toUpperCase()}
                              </div>
                            )}
                          </AvatarFrame>
                        </Link>

                        <div className="person-card-info">
                          <div className="person-name-row">
                            <Link to={`/profile/${target.username}`} className="person-name-link">
                              {target.displayName || target.username}
                            </Link>
                            {target.isPro && <ProBadge size="sm" />}
                          </div>
                          <span className="person-handle">@{target.username}</span>

                          {target.bio && <p className="person-bio-snippet">{target.bio}</p>}

                          {target.skills?.length > 0 && (
                            <div className="person-skills-chips">
                              {target.skills.slice(0, 2).map((s, idx) => (
                                <span key={idx} className="mini-chip">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {!isSelf && (
                          <button
                            type="button"
                            className={`person-follow-btn ${
                              isFollowing ? "following" : isPending ? "pending" : "follow"
                            }`}
                            disabled={isBusy}
                            onClick={() => handleFollowToggle(target.username)}
                          >
                            {isBusy ? (
                              <LoaderIcon size={13} />
                            ) : isFollowing ? (
                              "Following"
                            ) : isPending ? (
                              "Requested"
                            ) : (
                              "+ Follow"
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Popular Communities */}
            {popularCommunities.length > 0 && (
              <div className="discovery-block" style={{ marginTop: 32 }}>
                <div className="block-title-row">
                  <h3>Popular Communities</h3>
                  <span className="block-subtitle">Join active discussions and group meetings</span>
                </div>

                <div className="discovery-communities-grid">
                  {popularCommunities.slice(0, 4).map((comm) => (
                    <Link
                      key={comm._id}
                      to={`/communities/${comm.slug}`}
                      className="discovery-comm-card"
                    >
                      <div className="comm-card-top">
                        <div className="discovery-comm-icon">
                          {comm.avatar ? (
                            <img src={comm.avatar} alt={comm.name} />
                          ) : (
                            <span>{comm.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="comm-card-titles">
                          <strong className="comm-card-name">{comm.name}</strong>
                          <span className="comm-card-handle">@{comm.slug}</span>
                        </div>
                      </div>

                      <p className="comm-card-desc">
                        {comm.description || "Active student collaboration and discussion group."}
                      </p>

                      <div className="comm-card-footer">
                        <span className="comm-member-count">
                          <UsersIcon size={13} /> {comm.memberCount || 0} members
                        </span>
                        {comm.isPrivate ? (
                          <span className="comm-lock-tag"><LockIcon size={11} /> Private</span>
                        ) : (
                          <span className="comm-open-tag">Join →</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "people" ? (
          /* State 4: People Tab Search Results */
          peopleResults.length === 0 ? (
            <div className="search-empty-state-box">
              <div className="empty-state-icon-circle">
                <SearchIcon size={36} />
              </div>
              <h3 className="empty-state-title">No people found</h3>
              <p className="empty-state-subtitle">
                We couldn't find any students matching "<strong>{debouncedQuery}</strong>".
              </p>
              <div className="empty-state-tips-card">
                <strong>Helpful search tips:</strong>
                <ul>
                  <li>Check the spelling or try partial names (e.g. "rah" instead of "rahul sharma")</li>
                  <li>Search by @username directly</li>
                  <li>Search for specific academic skills (e.g. "React", "Python", "DSA")</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="search-results-list people-results-list">
              {peopleResults.map((target) => {
                const isSelf = target.username === user?.username;
                const status = followStatuses[target.username] || "NOT_FOLLOWING";
                const isFollowing = status === "FOLLOWING";
                const isPending = status === "PENDING";
                const isBusy = processingUser === target.username;

                return (
                  <div key={target._id || target.username} className="search-person-result-card">
                    <Link
                      to={`/profile/${target.username}`}
                      className="person-result-avatar-link"
                    >
                      <AvatarFrame decoration={target.avatarDecoration} size="lg">
                        {target.avatar ? (
                          <img
                            src={target.avatar}
                            alt={target.displayName}
                            className="result-avatar-img"
                          />
                        ) : (
                          <div className="result-avatar-placeholder">
                            {(target.displayName || target.username || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </AvatarFrame>
                    </Link>

                    <div className="person-result-body">
                      <div className="person-result-header">
                        <div>
                          <div className="person-result-title-row">
                            <Link
                              to={`/profile/${target.username}`}
                              className="person-result-name"
                            >
                              {target.displayName || target.username}
                            </Link>
                            {target.isPro && <ProBadge size="sm" />}
                          </div>
                          <span className="person-result-handle">@{target.username}</span>
                        </div>

                        {!isSelf && (
                          <button
                            type="button"
                            className={`person-result-follow-btn ${
                              isFollowing ? "following" : isPending ? "pending" : "follow"
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

                      {target.bio && (
                        <p className="person-result-bio">{target.bio}</p>
                      )}

                      {/* Skills and Interests chips */}
                      {((target.skills && target.skills.length > 0) ||
                        (target.interests && target.interests.length > 0)) && (
                        <div className="person-result-tags-row">
                          {target.skills?.slice(0, 4).map((skill, i) => (
                            <span key={`skill-${i}`} className="skill-badge-chip">
                              {skill}
                            </span>
                          ))}
                          {target.interests?.slice(0, 3).map((interest, i) => (
                            <span key={`int-${i}`} className="interest-badge-chip">
                              #{interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === "communities" ? (
          /* State 5: Communities Tab Search Results */
          communityResults.length === 0 ? (
            <div className="search-empty-state-box">
              <div className="empty-state-icon-circle">
                <UsersIcon size={36} />
              </div>
              <h3 className="empty-state-title">No communities found</h3>
              <p className="empty-state-subtitle">
                We couldn't find any communities matching "<strong>{debouncedQuery}</strong>".
              </p>
              <div className="empty-state-tips-card">
                <strong>Helpful search tips:</strong>
                <ul>
                  <li>Search for academic subjects (e.g. "Algorithms", "AI", "WebDev")</li>
                  <li>Search for student clubs or interest hubs</li>
                  <li>Browse popular communities on the Explore page</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="search-results-list communities-results-list">
              {communityResults.map((comm) => (
                <Link
                  key={comm._id}
                  to={`/communities/${comm.slug}`}
                  className="search-community-result-card"
                >
                  <div className="comm-result-avatar">
                    {comm.avatar ? (
                      <img src={comm.avatar} alt={comm.name} />
                    ) : (
                      <span>{comm.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="comm-result-body">
                    <div className="comm-result-top-row">
                      <div className="comm-result-titles">
                        <strong className="comm-result-name">{comm.name}</strong>
                        <span className="comm-result-handle">@{comm.slug}</span>
                      </div>

                      <div className="comm-result-tags">
                        {comm.isPrivate ? (
                          <span className="comm-privacy-badge private">
                            <LockIcon size={11} /> Private
                          </span>
                        ) : (
                          <span className="comm-privacy-badge public">Public</span>
                        )}
                        {comm.isBoosted && (
                          <span className="comm-boost-badge">🚀 Boosted</span>
                        )}
                      </div>
                    </div>

                    <p className="comm-result-desc">
                      {comm.description || "Student community and collaboration workspace on ANOY."}
                    </p>

                    <div className="comm-result-footer">
                      <span className="comm-result-members">
                        <UsersIcon size={13} /> {comm.memberCount || 0} Members
                      </span>
                      <span className="btn-open-comm-link">Open Community →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          /* State 6: Posts Tab Search Results */
          postResults.length === 0 ? (
            <div className="search-empty-state-box">
              <div className="empty-state-icon-circle">
                <MessageCircleIcon size={36} />
              </div>
              <h3 className="empty-state-title">No posts found</h3>
              <p className="empty-state-subtitle">
                No discussion posts matched "<strong>{debouncedQuery}</strong>".
              </p>
              <div className="empty-state-tips-card">
                <strong>Helpful search tips:</strong>
                <ul>
                  <li>Search for project ideas, question keywords, or study topics</li>
                  <li>Check for alternative keywords or hashtags</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="search-results-list posts-results-list">
              {postResults.map((post) => (
                <div key={post._id} className="search-post-result-card">
                  <div className="post-result-header">
                    <AvatarFrame decoration={post.author?.avatarDecoration} size="sm">
                      {post.author?.avatar ? (
                        <img
                          src={post.author.avatar}
                          alt={post.author.displayName}
                          className="post-result-author-img"
                        />
                      ) : (
                        <div className="post-result-author-fallback">
                          {(post.author?.displayName || post.author?.username || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                    </AvatarFrame>

                    <div className="post-result-author-meta">
                      <div className="post-author-name-row">
                        <Link
                          to={`/profile/${post.author?.username}`}
                          className="post-author-name"
                        >
                          {post.author?.displayName || post.author?.username}
                        </Link>
                        {post.author?.isPro && <ProBadge size="sm" />}
                        <span className="post-author-handle">
                          @{post.author?.username}
                        </span>
                      </div>
                      <span className="post-result-timestamp">
                        {new Date(post.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="post-result-text-content">{post.content}</p>

                  {post.media?.url && (
                    <div className="post-result-media-container">
                      <img
                        src={post.media.url}
                        alt="Post media attachment"
                        className="post-result-media-img"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="post-result-engagement-bar">
                    <span className="post-stat-item">
                      <HeartIcon size={14} className="stat-icon" />
                      <span>{post.likesCount || 0} Likes</span>
                    </span>
                    <span className="post-stat-item">
                      <MessageCircleIcon size={14} className="stat-icon" />
                      <span>{post.commentsCount || 0} Comments</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default Search;
