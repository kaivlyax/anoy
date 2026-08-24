import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { postApi } from "../services/api";
import PostComposer from "../components/PostComposer";
import PostCard from "../components/PostCard";
import { SparklesIcon, CompassIcon, LoaderIcon, AlertCircleIcon } from "../components/Icons";

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: 'for-you' | 'explore'
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "explore" ? "explore" : "for-you"
  );

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Sync tab change
  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSearchParams(tab === "explore" ? { tab: "explore" } : {});
    setPage(1);
    setPosts([]);
  };

  // Fetch feed posts
  const fetchFeed = useCallback(
    async (pageToFetch = 1, append = false) => {
      try {
        if (pageToFetch === 1) {
          setLoading(true);
          setError("");
        } else {
          setLoadingMore(true);
        }

        const fetcher =
          activeTab === "for-you"
            ? postApi.getPersonalizedFeed(pageToFetch, 10)
            : postApi.getExploreFeed(pageToFetch, 10);

        const response = await fetcher;

        if (response.data.success) {
          const fetchedPosts = response.data.posts || [];
          setTotalPages(response.data.totalPages || 1);

          if (append) {
            setPosts((prev) => [...prev, ...fetchedPosts]);
          } else {
            setPosts(fetchedPosts);
          }
        }
      } catch (err) {
        console.error("Feed error:", err);
        setError(
          err.response?.data?.message || "Failed to load feed. Please try again."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchFeed(1, false);
    }
    return () => {
      isMounted = false;
    };
  }, [fetchFeed]);

  // Handle Load More
  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage, true);
    }
  };

  // Prepend newly created post
  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  // Remove deleted post
  const handlePostDeleted = (deletedPostId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  };

  return (
    <div className="main-feed-column">
      {/* Sticky Header with Feed Tabs */}
      <header className="sticky-header">
        <h2 className="sticky-header-title">Home</h2>
        <div className="feed-tabs">
          <button
            className={`feed-tab ${activeTab === "for-you" ? "active" : ""}`}
            onClick={() => handleTabChange("for-you")}
            aria-label="For You Personalized Feed"
          >
            For You
          </button>
          <button
            className={`feed-tab ${activeTab === "explore" ? "active" : ""}`}
            onClick={() => handleTabChange("explore")}
            aria-label="Explore Global Feed"
          >
            Explore
          </button>
        </div>
      </header>

      {/* In-feed Post Composer */}
      <PostComposer onPostCreated={handlePostCreated} />

      {/* Main Feed Stream */}
      <main>
        {loading ? (
          <div>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-post-card">
                <div className="skeleton-box skeleton-avatar" />
                <div className="skeleton-lines">
                  <div
                    className="skeleton-box"
                    style={{ width: "35%", height: 14 }}
                  />
                  <div
                    className="skeleton-box"
                    style={{ width: "90%", height: 14 }}
                  />
                  <div
                    className="skeleton-box"
                    style={{ width: "65%", height: 14 }}
                  />
                  <div
                    className="skeleton-box"
                    style={{ width: "100%", height: 140, borderRadius: 8 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-feed">
            <div className="empty-feed-icon" style={{ color: "#ef4444" }}>
              <AlertCircleIcon size={30} />
            </div>
            <h3 className="empty-feed-title">Unable to load feed</h3>
            <p className="empty-feed-subtitle">{error}</p>
            <button
              className="composer-submit-btn"
              style={{ marginTop: 8 }}
              onClick={() => fetchFeed(1, false)}
            >
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-icon">
              {activeTab === "for-you" ? (
                <SparklesIcon size={30} />
              ) : (
                <CompassIcon size={30} />
              )}
            </div>
            <h3 className="empty-feed-title">
              {activeTab === "for-you"
                ? "Your personalized feed is empty"
                : "No posts found"}
            </h3>
            <p className="empty-feed-subtitle">
              {activeTab === "for-you"
                ? "Follow other users or create your first post to populate your home feed!"
                : "Be the first person to share a post with the network."}
            </p>
            {activeTab === "for-you" && (
              <button
                className="composer-submit-btn"
                style={{ marginTop: 8 }}
                onClick={() => handleTabChange("explore")}
              >
                Switch to Explore Feed
              </button>
            )}
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostDeleted={handlePostDeleted}
              />
            ))}

            {/* Pagination Load More */}
            {page < totalPages && (
              <button
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <LoaderIcon size={20} /> : "Load more posts"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;