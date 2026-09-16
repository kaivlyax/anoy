import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { communityApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import {
  UsersIcon,
  SearchIcon,
  PlusIcon,
  SparklesIcon,
  LoaderIcon,
  XIcon,
  LockIcon
} from "../components/Icons";

export default function Communities() {
  const { addToast } = useToast();

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all"); // 'all' | 'joined' | 'popular' | 'public' | 'private'
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for create community
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await communityApi.getCommunities({ q: searchQuery });
      if (res.data.success) {
        setCommunities(res.data.communities || []);
      }
    } catch (err) {
      console.error("Fetch communities error:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommunities();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCommunities]);

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      const res = await communityApi.createCommunity({
        name,
        slug,
        description,
        avatar,
        coverImage,
        isPrivate
      });

      if (res.data.success) {
        addToast(`Created ${res.data.community.name}!`, "success");
        setShowCreateModal(false);
        setName("");
        setSlug("");
        setDescription("");
        setAvatar("");
        setCoverImage("");
        setIsPrivate(false);
        fetchCommunities();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to create community", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLeave = async (comm, e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (comm.userRole === "NONE") {
        const res = await communityApi.joinCommunity(comm._id);
        if (res.data.success) {
          addToast(`Joined ${comm.name}!`, "success");
          fetchCommunities();
        }
      } else if (comm.userRole === "MEMBER" || comm.userRole === "MODERATOR") {
        const res = await communityApi.leaveCommunity(comm._id);
        if (res.data.success) {
          addToast(`Left ${comm.name}`, "info");
          fetchCommunities();
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Action failed", "error");
    }
  };

  const boostedCommunities = communities.filter((c) => c.isBoosted);

  // Filter communities by selected tab chip
  const filteredCommunities = communities.filter((comm) => {
    if (filterCategory === "joined") {
      return comm.userRole && comm.userRole !== "NONE";
    }
    if (filterCategory === "popular") {
      return comm.isBoosted || (comm.memberCount || 0) >= 3;
    }
    if (filterCategory === "public") {
      return !comm.isPrivate;
    }
    if (filterCategory === "private") {
      return comm.isPrivate;
    }
    return true;
  });

  return (
    <div className="communities-page">
      {/* Top Header */}
      <div className="communities-header">
        <div>
          <h1 className="page-title">Communities</h1>
          <p className="page-subtitle">Connect, collaborate, and share with like-minded creators.</p>
        </div>
        <button
          type="button"
          className="create-community-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon size={16} />
          <span>Create Community</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="community-search-container">
        <div className="search-input-glass-box">
          <span className="search-glass-icon">
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            placeholder="Search communities by name, topic, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-glass-input"
            aria-label="Search communities"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear community search"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        {/* Filter Chips Bar */}
        <div className="community-filter-chips-row">
          <button
            type="button"
            className={`comm-filter-chip ${filterCategory === "all" ? "active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            All ({communities.length})
          </button>
          <button
            type="button"
            className={`comm-filter-chip ${filterCategory === "joined" ? "active" : ""}`}
            onClick={() => setFilterCategory("joined")}
          >
            Joined ({communities.filter((c) => c.userRole && c.userRole !== "NONE").length})
          </button>
          <button
            type="button"
            className={`comm-filter-chip ${filterCategory === "popular" ? "active" : ""}`}
            onClick={() => setFilterCategory("popular")}
          >
            🚀 Popular ({communities.filter((c) => c.isBoosted || (c.memberCount || 0) >= 3).length})
          </button>
          <button
            type="button"
            className={`comm-filter-chip ${filterCategory === "public" ? "active" : ""}`}
            onClick={() => setFilterCategory("public")}
          >
            Public ({communities.filter((c) => !c.isPrivate).length})
          </button>
          <button
            type="button"
            className={`comm-filter-chip ${filterCategory === "private" ? "active" : ""}`}
            onClick={() => setFilterCategory("private")}
          >
            🔒 Private ({communities.filter((c) => c.isPrivate).length})
          </button>
        </div>
      </div>

      {/* Boosted Communities Showcase */}
      {boostedCommunities.length > 0 && !searchQuery && filterCategory === "all" && (
        <div className="boosted-section">
          <div className="boosted-section-title">
            <SparklesIcon size={18} className="boosted-sparkle" />
            <h3>Boosted Communities</h3>
            <span className="boosted-level-tag">PRO POWERED</span>
          </div>

          <div className="boosted-grid">
            {boostedCommunities.map((comm) => (
              <Link key={comm._id} to={`/communities/${comm.slug}`} className="boosted-card">
                <div className="boosted-badge-corner">
                  🚀 Level {comm.boostLevel || 1} • {comm.boostCount} Boosts
                </div>
                {comm.coverImage && (
                  <div
                    className="boosted-cover-img"
                    style={{ backgroundImage: `url(${comm.coverImage})` }}
                  />
                )}
                <div className="boosted-card-content">
                  <div className="boosted-avatar-row">
                    <div className="comm-avatar">
                      {comm.avatar ? (
                        <img src={comm.avatar} alt={comm.name} />
                      ) : (
                        <span>{comm.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="comm-name">{comm.name}</h4>
                      <span className="comm-slug">@{comm.slug}</span>
                    </div>
                  </div>
                  <p className="comm-desc">{comm.description || "No description provided."}</p>
                  <div className="comm-stats">
                    <UsersIcon size={14} />
                    <span>{comm.memberCount} members</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Communities List */}
      <div className="all-communities-section">
        <h3 className="section-subtitle">
          {filterCategory === "joined"
            ? "My Communities"
            : filterCategory === "popular"
            ? "Popular & Boosted Communities"
            : filterCategory === "private"
            ? "Private Communities"
            : "Explore All Communities"}
        </h3>

        {loading ? (
          <div className="communities-loading">
            <LoaderIcon size={28} />
            <p>Loading communities...</p>
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="communities-empty">
            <UsersIcon size={44} className="empty-icon" />
            <p>
              {searchQuery
                ? `No communities found matching "${searchQuery}".`
                : "No communities found in this category."}
            </p>
          </div>
        ) : (
          <div className="communities-list-grid">
            {filteredCommunities.map((comm) => (
              <Link key={comm._id} to={`/communities/${comm.slug}`} className="community-card">
                <div className="comm-card-main">
                  <div className="comm-avatar">
                    {comm.avatar ? (
                      <img src={comm.avatar} alt={comm.name} />
                    ) : (
                      <span>{comm.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="comm-info">
                    <div className="comm-header-row">
                      <h4 className="comm-title">{comm.name}</h4>
                      {comm.isPrivate && (
                        <span className="comm-privacy-pill" title="Private Community">
                          <LockIcon size={11} /> Private
                        </span>
                      )}
                      {comm.isBoosted && (
                        <span className="comm-boost-badge">
                          🚀 Lvl {comm.boostLevel}
                        </span>
                      )}
                    </div>
                    <span className="comm-handle">@{comm.slug}</span>
                    <p className="comm-snippet">{comm.description || "Welcome to our community!"}</p>
                    <div className="comm-footer-meta">
                      <span className="member-pill">
                        <UsersIcon size={12} /> {comm.memberCount} members
                      </span>
                      {comm.userRole !== "NONE" && (
                        <span className={`role-pill role-${comm.userRole.toLowerCase()}`}>
                          {comm.userRole}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="comm-card-action">
                  {comm.userRole === "OWNER" ? (
                    <span className="role-owner-tag">Owner</span>
                  ) : comm.userRole !== "NONE" ? (
                    <button
                      type="button"
                      className="btn-comm-joined"
                      onClick={(e) => handleJoinLeave(comm, e)}
                    >
                      Joined
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-comm-join"
                      onClick={(e) => handleJoinLeave(comm, e)}
                    >
                      Join
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CREATE COMMUNITY MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content create-comm-modal">
            <div className="modal-header">
              <h3>Create a New Community</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="create-comm-form">
              <div className="form-group">
                <label htmlFor="comm-name">Community Name *</label>
                <input
                  id="comm-name"
                  type="text"
                  placeholder="e.g. React Developers, AI Creators"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="comm-slug">Handle / Slug</label>
                <input
                  id="comm-slug"
                  type="text"
                  placeholder="e.g. react-devs"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comm-desc">Description</label>
                <textarea
                  id="comm-desc"
                  rows={3}
                  placeholder="What is this community about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comm-avatar">Avatar URL</label>
                <input
                  id="comm-avatar"
                  type="url"
                  placeholder="https://..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comm-cover">Cover Banner URL</label>
                <input
                  id="comm-cover"
                  type="url"
                  placeholder="https://..."
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span>Private Community (Requires approval to view/join)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={creating || !name.trim()}
                >
                  {creating ? <LoaderIcon size={16} /> : "Create Community"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
