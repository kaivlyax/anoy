import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { profileApi, followApi, postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PostCard from "../components/PostCard";
import EditProfileModal from "../components/EditProfileModal";
import FollowListModal from "../components/FollowListModal";
import {
  LockIcon,
  GlobeIcon,
  LoaderIcon,
  AlertCircleIcon,
  UsersIcon,
  MessageCircleIcon
} from "../components/Icons";

function Profile() {
  const { username: paramUsername } = useParams();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { addToast } = useToast();

  const isOwnProfile = !paramUsername || paramUsername.toLowerCase() === user?.username?.toLowerCase();
  const targetUsername = paramUsername || user?.username;

  const [profile, setProfile] = useState(isOwnProfile ? myProfile : null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [followStatus, setFollowStatus] = useState("NOT_FOLLOWING"); // 'NOT_FOLLOWING' | 'PENDING' | 'FOLLOWING'
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPrivateRestricted, setIsPrivateRestricted] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState(null); // 'followers' | 'following' | null

  // Fetch Profile & Stats
  const fetchProfileData = useCallback(async () => {
    if (!targetUsername) return;
    try {
      setLoading(true);
      setError("");
      setIsPrivateRestricted(false);

      if (isOwnProfile) {
        const response = await profileApi.getMyProfile();
        if (response.data.success) {
          setProfile(response.data.profile);
        }
      } else {
        try {
          const profRes = await profileApi.getProfile(targetUsername);
          if (profRes.data.success) {
            setProfile(profRes.data.profile);
          }
        } catch (err) {
          if (err.response?.status === 403) {
            setIsPrivateRestricted(true);
            setProfile({
              username: targetUsername,
              displayName: targetUsername,
              bio: "This account is private.",
              privacy: "PRIVATE"
            });
          } else {
            setError(err.response?.data?.message || "User profile not found");
            return;
          }
        }

        // Fetch follow status for other user
        try {
          const statusRes = await followApi.getFollowStatus(targetUsername);
          if (statusRes.data.success) {
            setFollowStatus(statusRes.data.relationship);
            if (statusRes.data.relationship === "FOLLOWING") {
              setIsPrivateRestricted(false);
            }
          }
        } catch {
          // ignore
        }
      }

      // Fetch followers/following stats
      try {
        const statsRes = await profileApi.getProfileStats(targetUsername);
        if (statsRes.data.success) {
          setStats(statsRes.data.stats || { followers: 0, following: 0 });
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while loading profile.");
    } finally {
      setLoading(false);
    }
  }, [targetUsername, isOwnProfile]);

  // Fetch posts by this user
  const fetchUserPosts = useCallback(async () => {
    if (!targetUsername || isPrivateRestricted) return;

    try {
      setPostsLoading(true);
      const response = await postApi.getExploreFeed(1, 50);
      if (response.data.success && response.data.posts) {
        const filtered = response.data.posts.filter(
          (p) =>
            p.author?.username?.toLowerCase() === targetUsername.toLowerCase()
        );
        setUserPosts(filtered);
      }
    } catch (err) {
      console.warn("Failed to load user posts", err);
    } finally {
      setPostsLoading(false);
    }
  }, [targetUsername, isPrivateRestricted]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (profile && !isPrivateRestricted) {
      fetchUserPosts();
    }
  }, [profile, isPrivateRestricted, fetchUserPosts]);

  // Follow / Unfollow action
  const handleFollowToggle = async () => {
    if (followBusy) return;
    setFollowBusy(true);

    if (followStatus === "FOLLOWING" || followStatus === "PENDING") {
      try {
        const res = await followApi.unfollowUser(targetUsername);
        if (res.data.success) {
          setFollowStatus("NOT_FOLLOWING");
          setStats((prev) => ({
            ...prev,
            followers: Math.max(0, prev.followers - 1)
          }));
          addToast(`Unfollowed @${targetUsername}`, "info");
          if (profile?.privacy === "PRIVATE") {
            setIsPrivateRestricted(true);
            setUserPosts([]);
          }
        }
      } catch (err) {
        addToast(err.response?.data?.message || "Failed to unfollow", "error");
      } finally {
        setFollowBusy(false);
      }
    } else {
      try {
        const res = await followApi.followUser(targetUsername);
        if (res.data.success) {
          const newStatus =
            res.data.status === "PENDING" ? "PENDING" : "FOLLOWING";
          setFollowStatus(newStatus);
          if (newStatus === "FOLLOWING") {
            setStats((prev) => ({
              ...prev,
              followers: prev.followers + 1
            }));
            setIsPrivateRestricted(false);
            fetchUserPosts();
          }
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
        setFollowBusy(false);
      }
    }
  };

  const handlePostDeleted = (deletedPostId) => {
    setUserPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  };

  const isFollowing = followStatus === "FOLLOWING";
  const isPending = followStatus === "PENDING";

  return (
    <div className="main-feed-column">
      {/* Sticky Header */}
      <header className="sticky-header">
        <h2 className="sticky-header-title">
          {profile?.displayName || targetUsername || "Profile"}
        </h2>
      </header>

      <main>
        {loading ? (
          <div>
            <div
              className="skeleton-box"
              style={{ width: "100%", height: 180, borderRadius: 0 }}
            />
            <div style={{ padding: 20 }}>
              <div
                className="skeleton-box"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  marginTop: -45,
                  marginBottom: 16
                }}
              />
              <div
                className="skeleton-box"
                style={{ width: "40%", height: 20, marginBottom: 8 }}
              />
              <div
                className="skeleton-box"
                style={{ width: "25%", height: 14, marginBottom: 14 }}
              />
              <div
                className="skeleton-box"
                style={{ width: "80%", height: 14, marginBottom: 8 }}
              />
              <div
                className="skeleton-box"
                style={{ width: "60%", height: 14 }}
              />
            </div>
          </div>
        ) : error ? (
          <div className="empty-feed">
            <div className="empty-feed-icon" style={{ color: "#ef4444" }}>
              <AlertCircleIcon size={30} />
            </div>
            <h3 className="empty-feed-title">Profile Unavailable</h3>
            <p className="empty-feed-subtitle">{error}</p>
            <button
              className="composer-submit-btn"
              style={{ marginTop: 8 }}
              onClick={fetchProfileData}
            >
              Try Again
            </button>
          </div>
        ) : profile ? (
          <div>
            {/* Profile Banner */}
            <div className="profile-banner-container">
              {profile.coverImage ? (
                <img
                  src={profile.coverImage}
                  alt="Profile Banner"
                  className="profile-banner-image"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div className="profile-banner-fallback" />
              )}

              {/* Avatar & Action Button Row */}
              <div className="profile-header-actions-bar">
                <div className="profile-large-avatar">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.username}
                      className="profile-avatar-img"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    (profile.displayName || profile.username || "U")
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>

                <div className="profile-actions-group">
                  {isOwnProfile ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {profile.privacy === "PRIVATE" && (
                        <Link
                          to="/follow-requests"
                          className="composer-submit-btn"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-light)",
                            color: "var(--text-main)"
                          }}
                        >
                          <UsersIcon size={16} />
                          <span>Requests</span>
                        </Link>
                      )}
                      <button
                        className="composer-submit-btn"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-light)",
                          color: "var(--text-main)"
                        }}
                        onClick={() => setIsEditModalOpen(true)}
                      >
                        Edit Profile
                      </button>
                    </div>
                  ) : (
                    <button
                      className={`follow-toggle-btn ${
                        isFollowing
                          ? "following"
                          : isPending
                          ? "requested"
                          : "follow"
                      }`}
                      style={{ padding: "8px 22px", fontSize: 14 }}
                      disabled={followBusy}
                      onClick={handleFollowToggle}
                    >
                      {followBusy ? (
                        <LoaderIcon size={14} />
                      ) : isFollowing ? (
                        "Following"
                      ) : isPending ? (
                        "Requested"
                      ) : (
                        "Follow"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Meta Details */}
            <div className="profile-meta-content">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 className="profile-display-name">
                  {profile.displayName || profile.username}
                </h1>
                <span
                  className="post-visibility-badge"
                  style={{ fontSize: 12, padding: "3px 8px" }}
                >
                  {profile.privacy === "PRIVATE" ? (
                    <>
                      <LockIcon size={12} /> Private
                    </>
                  ) : (
                    <>
                      <GlobeIcon size={12} /> Public
                    </>
                  )}
                </span>
              </div>

              <span className="profile-username-tag">@{profile.username}</span>

              {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}

              {/* Followers & Following Counts */}
              <div className="profile-stats-row">
                <button
                  type="button"
                  className="profile-stat-item"
                  onClick={() => setFollowModalType("following")}
                  aria-label={`View ${stats.following} following`}
                >
                  <strong className="profile-stat-count">{stats.following}</strong>
                  <span className="profile-stat-label">Following</span>
                </button>

                <button
                  type="button"
                  className="profile-stat-item"
                  onClick={() => setFollowModalType("followers")}
                  aria-label={`View ${stats.followers} followers`}
                >
                  <strong className="profile-stat-count">{stats.followers}</strong>
                  <span className="profile-stat-label">Followers</span>
                </button>
              </div>

              {/* Skills & Interests Tags */}
              {((profile.skills && profile.skills.length > 0) ||
                (profile.interests && profile.interests.length > 0)) && (
                <div className="profile-tags-wrapper">
                  {profile.skills?.length > 0 && (
                    <div className="profile-tags-group">
                      <span className="profile-tags-label">Skills</span>
                      <div className="profile-tags-chips">
                        {profile.skills.map((skill, i) => (
                          <span key={i} className="skill-chip">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.interests?.length > 0 && (
                    <div className="profile-tags-group">
                      <span className="profile-tags-label">Interests</span>
                      <div className="profile-tags-chips">
                        {profile.interests.map((interest, i) => (
                          <span key={i} className="interest-chip">
                            #{interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Feed / Posts Section */}
            <div className="profile-posts-section">
              <div className="profile-posts-header">
                <h3>Posts</h3>
              </div>

              {isPrivateRestricted ? (
                <div className="empty-feed" style={{ padding: "60px 20px" }}>
                  <div className="empty-feed-icon">
                    <LockIcon size={32} />
                  </div>
                  <h3 className="empty-feed-title">This Account is Private</h3>
                  <p className="empty-feed-subtitle">
                    Follow this account to see their photos and posts.
                  </p>
                </div>
              ) : postsLoading ? (
                <div className="feed-loading-container">
                  <LoaderIcon size={28} />
                </div>
              ) : userPosts.length === 0 ? (
                <div className="empty-feed" style={{ padding: "50px 20px" }}>
                  <div className="empty-feed-icon">
                    <MessageCircleIcon size={28} />
                  </div>
                  <h3 className="empty-feed-title" style={{ fontSize: 17 }}>
                    No posts yet
                  </h3>
                  <p className="empty-feed-subtitle">
                    {isOwnProfile
                      ? "When you publish posts, they will show up here."
                      : `@${profile.username} hasn't posted anything yet.`}
                  </p>
                </div>
              ) : (
                <div>
                  {userPosts.map((post) => (
                    <PostCard
                      key={post._id}
                      post={post}
                      onPostDeleted={handlePostDeleted}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            refreshProfile();
          }}
        />
      )}

      {/* Follow List Modal */}
      {followModalType && (
        <FollowListModal
          isOpen={Boolean(followModalType)}
          onClose={() => setFollowModalType(null)}
          username={targetUsername}
          type={followModalType}
        />
      )}
    </div>
  );
}

export default Profile;