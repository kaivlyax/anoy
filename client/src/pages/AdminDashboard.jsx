import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { adminApi } from "../services/api";
import {
  ShieldIcon,
  SearchIcon,
  UsersIcon,
  BanIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  EyeIcon,
  MessageCircleIcon,
  ClockIcon,
  XIcon,
  SparklesIcon,
  LockIcon,
  UserIcon,
  CheckIcon
} from "../components/Icons";
import ProBadge from "../components/ProBadge";

function AdminDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "users";

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  // ==========================================
  // TAB 1: USERS STATE & HANDLERS
  // ==========================================
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modals
  const [selectedUserModal, setSelectedUserModal] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  const [banModalUser, setBanModalUser] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);

  const [unbanModalUser, setUnbanModalUser] = useState(null);
  const [unbanReason, setUnbanReason] = useState("");
  const [unbanSubmitting, setUnbanSubmitting] = useState(false);

  const [restrictModalUser, setRestrictModalUser] = useState(null);
  const [restrictReason, setRestrictReason] = useState("");
  const [restrictDuration, setRestrictDuration] = useState("24h");
  const [restrictCustomDate, setRestrictCustomDate] = useState("");
  const [restrictSubmitting, setRestrictSubmitting] = useState(false);

  const [unrestrictModalUser, setUnrestrictModalUser] = useState(null);
  const [unrestrictReason, setUnrestrictReason] = useState("");
  const [unrestrictSubmitting, setUnrestrictSubmitting] = useState(false);

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setUsersLoading(true);
        const params = {
          page,
          limit: 15
        };
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (selectedRole) params.role = selectedRole;
        if (selectedStatus) params.status = selectedStatus;

        const res = await adminApi.getUsers(params);
        if (res.data.success) {
          setUsers(res.data.users || []);
          setUsersTotal(res.data.total || 0);
          setUsersPage(res.data.page || 1);
          setUsersTotalPages(res.data.totalPages || 1);
        }
      } catch (err) {
        console.error("Admin fetchUsers error:", err);
        addToast(err.response?.data?.message || "Failed to load platform users", "error");
      } finally {
        setUsersLoading(false);
      }
    },
    [searchQuery, selectedRole, selectedStatus, addToast]
  );

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers(usersPage);
    }
  }, [activeTab, usersPage, fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setUsersPage(1);
    fetchUsers(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRole("");
    setSelectedStatus("");
    setUsersPage(1);
  };

  const handleOpenUserDetails = async (targetUser) => {
    setSelectedUserModal(targetUser);
    setUserDetails(null);
    setLoadingUserDetails(true);
    try {
      const res = await adminApi.getUser(targetUser._id);
      if (res.data.success) {
        setUserDetails(res.data.user);
      }
    } catch (err) {
      console.error("Admin getUser error:", err);
      addToast(err.response?.data?.message || "Failed to load user details", "error");
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleOpenBanModal = (targetUser) => {
    setBanModalUser(targetUser);
    setBanReason("");
  };

  const handleConfirmBan = async (e) => {
    e.preventDefault();
    if (!banModalUser) return;
    if (!banReason.trim()) {
      addToast("A mandatory ban reason is required", "error");
      return;
    }

    try {
      setBanSubmitting(true);
      const res = await adminApi.banUser(banModalUser._id, banReason.trim());
      if (res.data.success) {
        addToast(res.data.message || `User @${banModalUser.username} has been banned`, "success");
        setBanModalUser(null);
        setBanReason("");
        if (selectedUserModal && selectedUserModal._id === banModalUser._id) {
          handleOpenUserDetails(banModalUser);
        }
        fetchUsers(usersPage);
      }
    } catch (err) {
      console.error("Admin banUser error:", err);
      addToast(err.response?.data?.message || "Failed to ban user", "error");
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleOpenUnbanModal = (targetUser) => {
    setUnbanModalUser(targetUser);
    setUnbanReason("");
  };

  const handleConfirmUnban = async (e) => {
    e.preventDefault();
    if (!unbanModalUser) return;

    try {
      setUnbanSubmitting(true);
      const res = await adminApi.unbanUser(unbanModalUser._id, unbanReason.trim() || "Unbanned by administrator");
      if (res.data.success) {
        addToast(res.data.message || `User @${unbanModalUser.username} has been unbanned`, "success");
        setUnbanModalUser(null);
        setUnbanReason("");
        if (selectedUserModal && selectedUserModal._id === unbanModalUser._id) {
          handleOpenUserDetails(unbanModalUser);
        }
        fetchUsers(usersPage);
      }
    } catch (err) {
      console.error("Admin unbanUser error:", err);
      addToast(err.response?.data?.message || "Failed to unban user", "error");
    } finally {
      setUnbanSubmitting(false);
    }
  };

  const handleOpenRestrictModal = (targetUser) => {
    setRestrictModalUser(targetUser);
    setRestrictReason("");
    setRestrictDuration("24h");
    setRestrictCustomDate("");
  };

  const handleConfirmRestrict = async (e) => {
    e.preventDefault();
    if (!restrictModalUser) return;
    if (!restrictReason.trim()) {
      addToast("A mandatory restriction reason is required", "error");
      return;
    }

    try {
      setRestrictSubmitting(true);
      const payload = {
        reason: restrictReason.trim(),
        duration: restrictDuration === "custom" ? undefined : restrictDuration,
        expiresAt: restrictDuration === "custom" && restrictCustomDate ? new Date(restrictCustomDate).toISOString() : undefined
      };

      const res = await adminApi.restrictUser(restrictModalUser._id, payload);
      if (res.data.success) {
        addToast(res.data.message || `User @${restrictModalUser.username} has been restricted`, "success");
        setRestrictModalUser(null);
        setRestrictReason("");
        if (selectedUserModal && selectedUserModal._id === restrictModalUser._id) {
          handleOpenUserDetails(restrictModalUser);
        }
        fetchUsers(usersPage);
      }
    } catch (err) {
      console.error("Admin restrictUser error:", err);
      addToast(err.response?.data?.message || "Failed to restrict user", "error");
    } finally {
      setRestrictSubmitting(false);
    }
  };

  const handleOpenUnrestrictModal = (targetUser) => {
    setUnrestrictModalUser(targetUser);
    setUnrestrictReason("");
  };

  const handleConfirmUnrestrict = async (e) => {
    e.preventDefault();
    if (!unrestrictModalUser) return;

    try {
      setUnrestrictSubmitting(true);
      const res = await adminApi.unrestrictUser(
        unrestrictModalUser._id,
        { reason: unrestrictReason.trim() || "Unrestricted by administrator" }
      );
      if (res.data.success) {
        addToast(res.data.message || `Restriction for @${unrestrictModalUser.username} has been lifted`, "success");
        setUnrestrictModalUser(null);
        setUnrestrictReason("");
        if (selectedUserModal && selectedUserModal._id === unrestrictModalUser._id) {
          handleOpenUserDetails(unrestrictModalUser);
        }
        fetchUsers(usersPage);
      }
    } catch (err) {
      console.error("Admin unrestrictUser error:", err);
      addToast(err.response?.data?.message || "Failed to remove restriction", "error");
    } finally {
      setUnrestrictSubmitting(false);
    }
  };

  // ==========================================
  // TAB 2: TARGETED PRIVATE MESSAGE REVIEW STATE & HANDLERS
  // ==========================================
  const [pmUserSearchQuery, setPmUserSearchQuery] = useState("");
  const [pmUserSearchResults, setPmUserSearchResults] = useState([]);
  const [pmUserSearchLoading, setPmUserSearchLoading] = useState(false);
  const [pmSelectedUser, setPmSelectedUser] = useState(null);

  const [pmConversations, setPmConversations] = useState([]);
  const [pmConversationsLoading, setPmConversationsLoading] = useState(false);
  const [pmSelectedConversation, setPmSelectedConversation] = useState(null);

  const [showManualConvId, setShowManualConvId] = useState(false);
  const [manualConvId, setManualConvId] = useState("");

  const [reviewReason, setReviewReason] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);

  const handleSearchPmUser = async (e) => {
    if (e) e.preventDefault();
    if (!pmUserSearchQuery.trim()) {
      addToast("Please enter a username or email to search", "error");
      return;
    }
    try {
      setPmUserSearchLoading(true);
      const res = await adminApi.getUsers({ q: pmUserSearchQuery.trim(), limit: 10 });
      if (res.data.success) {
        setPmUserSearchResults(res.data.users || []);
        if ((res.data.users || []).length === 0) {
          addToast("No users found matching that query", "info");
        }
      }
    } catch (err) {
      console.error("Admin PM user search error:", err);
      addToast(err.response?.data?.message || "Failed to search users", "error");
    } finally {
      setPmUserSearchLoading(false);
    }
  };

  const handleSelectPmUser = async (targetUser) => {
    setPmSelectedUser(targetUser);
    setPmSelectedConversation(null);
    setPmConversations([]);
    setPmUserSearchResults([]);
    try {
      setPmConversationsLoading(true);
      const res = await adminApi.getUserConversations(targetUser._id);
      if (res.data.success) {
        setPmConversations(res.data.conversations || []);
      }
    } catch (err) {
      console.error("Admin getUserConversations error:", err);
      addToast(err.response?.data?.message || "Failed to load user conversations", "error");
    } finally {
      setPmConversationsLoading(false);
    }
  };

  const handleClearPmUser = () => {
    setPmSelectedUser(null);
    setPmConversations([]);
    setPmSelectedConversation(null);
    setPmUserSearchQuery("");
    setPmUserSearchResults([]);
  };

  const handleStartReview = async (e, page = 1) => {
    if (e) e.preventDefault();
    const convIdToUse = pmSelectedConversation ? pmSelectedConversation._id : manualConvId.trim();
    if (!convIdToUse) {
      addToast("Please select a conversation or enter a valid Conversation ID", "error");
      return;
    }
    if (!reviewReason.trim()) {
      addToast("A mandatory non-empty justification is required to review private messages", "error");
      return;
    }

    try {
      setReviewLoading(true);
      const res = await adminApi.reviewPrivateMessages(
        convIdToUse,
        reviewReason.trim(),
        { page, limit: 50 }
      );
      if (res.data.success) {
        setReviewData(res.data);
        setReviewPage(page);
        addToast("Private message audit log recorded. Review session active.", "info");
      }
    } catch (err) {
      console.error("Admin reviewPrivateMessages error:", err);
      addToast(err.response?.data?.message || "Failed to review conversation messages", "error");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleEndReview = () => {
    setReviewData(null);
    setReviewReason("");
  };

  // ==========================================
  // TAB 3: AUDIT LOGS STATE & HANDLERS
  // ==========================================
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAuditLogs = useCallback(
    async (page = 1) => {
      try {
        setAuditLoading(true);
        const params = {
          page,
          limit: 20
        };
        if (auditActionFilter) params.action = auditActionFilter;

        const res = await adminApi.getAuditLogs(params);
        if (res.data.success) {
          setAuditLogs(res.data.logs || []);
          setAuditTotal(res.data.total || 0);
          setAuditPage(res.data.page || 1);
          setAuditTotalPages(res.data.totalPages || 1);
        }
      } catch (err) {
        console.error("Admin getAuditLogs error:", err);
        addToast(err.response?.data?.message || "Failed to load audit logs", "error");
      } finally {
        setAuditLoading(false);
      }
    },
    [auditActionFilter, addToast]
  );

  useEffect(() => {
    if (activeTab === "audit-logs") {
      fetchAuditLogs(auditPage);
    }
  }, [activeTab, auditPage, fetchAuditLogs]);

  // Helper formatting functions
  const formatDate = (isoStr) => {
    if (!isoStr) return "N/A";
    return new Date(isoStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const renderRoleBadge = (role) => {
    switch (role) {
      case "ADMIN":
        return <span className="admin-role-badge badge-admin">ADMIN</span>;
      case "MODERATOR":
        return <span className="admin-role-badge badge-moderator">MODERATOR</span>;
      case "SUPPORT":
        return <span className="admin-role-badge badge-support">SUPPORT</span>;
      default:
        return <span className="admin-role-badge badge-user">USER</span>;
    }
  };

  const renderStatusBadge = (status, banReason, restriction) => {
    if (status === "BANNED") {
      return (
        <span
          className="admin-status-badge badge-banned"
          title={banReason ? `Reason: ${banReason}` : "Banned account"}
        >
          BANNED
        </span>
      );
    }
    if (restriction?.isRestricted) {
      const expiryText = restriction.expiresAt
        ? `Until ${formatDate(restriction.expiresAt)}`
        : "Permanent";
      return (
        <span
          className="admin-status-badge badge-restricted"
          title={`Restricted: ${restriction.reason || "Administrative restriction"} (${expiryText})`}
        >
          RESTRICTED
        </span>
      );
    }
    switch (status) {
      case "ACTIVE":
        return <span className="admin-status-badge badge-active">ACTIVE</span>;
      case "PENDING":
        return <span className="admin-status-badge badge-pending">PENDING</span>;
      default:
        return <span className="admin-status-badge badge-unknown">{status || "UNKNOWN"}</span>;
    }
  };

  return (
    <div className="admin-dashboard-layout main-feed-column">
      {/* Platform Admin Sticky Header */}
      <header className="admin-header glass-panel">
        <div className="admin-header-title-row">
          <div className="admin-header-left">
            <div className="admin-shield-icon-badge">
              <ShieldIcon size={24} />
            </div>
            <div>
              <h1 className="admin-page-title">Platform Administration</h1>
              <p className="admin-page-subtitle">
                System Governance &bull; Security &bull; Audit Trail
              </p>
            </div>
          </div>
          <div className="admin-header-user-meta">
            <span className="admin-badge-indicator">
              <span className="admin-pulse-dot"></span>
              Admin Session: @{user?.username}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="admin-nav-tabs" aria-label="Admin Sections">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => handleTabChange("users")}
          >
            <UsersIcon size={18} />
            <span>User Management</span>
            {usersTotal > 0 && <span className="admin-tab-count">{usersTotal}</span>}
          </button>

          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "pm-review" ? "active" : ""}`}
            onClick={() => handleTabChange("pm-review")}
          >
            <LockIcon size={18} />
            <span>Targeted PM Review</span>
          </button>

          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "audit-logs" ? "active" : ""}`}
            onClick={() => handleTabChange("audit-logs")}
          >
            <ClockIcon size={18} />
            <span>Audit Trail</span>
            {auditTotal > 0 && <span className="admin-tab-count">{auditTotal}</span>}
          </button>
        </nav>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: USER MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "users" && (
        <section className="admin-tab-section" aria-label="User Management">
          {/* Search & Filters Bar */}
          <div className="admin-filter-bar glass-panel">
            <form onSubmit={handleSearchSubmit} className="admin-search-form">
              <div className="admin-search-input-wrapper">
                <SearchIcon size={18} className="admin-search-icon" />
                <input
                  type="text"
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="admin-clear-input-btn"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search input"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>
              <button type="submit" className="admin-btn admin-btn-primary">
                Search
              </button>
            </form>

            <div className="admin-filter-dropdowns">
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setUsersPage(1);
                }}
                className="admin-select"
                aria-label="Filter by Role"
              >
                <option value="">All Roles</option>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setUsersPage(1);
                }}
                className="admin-select"
                aria-label="Filter by Status"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="BANNED">BANNED</option>
                <option value="PENDING">PENDING</option>
              </select>

              {(searchQuery || selectedRole || selectedStatus) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="admin-btn admin-btn-ghost"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Users Table / List */}
          <div className="admin-table-container glass-panel">
            {usersLoading ? (
              <div className="admin-loading-state">
                <LoaderIcon size={36} className="admin-spin" />
                <p>Loading platform accounts...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="admin-empty-state">
                <UsersIcon size={48} className="admin-empty-icon" />
                <h3>No Users Found</h3>
                <p>No platform accounts matched the specified search or filter criteria.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((targetUser) => {
                      const isSelf = targetUser._id === user?._id || targetUser.username === user?.username;
                      const isTargetAdmin = targetUser.role === "ADMIN";
                      const isBanned = targetUser.status === "BANNED";
                      const isRestricted = targetUser.restriction?.isRestricted;

                      return (
                        <tr key={targetUser._id} className={isBanned ? "row-banned" : isRestricted ? "row-restricted" : ""}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="admin-user-avatar">
                                {targetUser.profile?.avatar ? (
                                  <img
                                    src={targetUser.profile.avatar}
                                    alt={targetUser.username}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  targetUser.username.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="admin-user-info-text">
                                <div className="admin-user-name-line">
                                  <span className="admin-user-display-name">
                                    {targetUser.profile?.displayName || targetUser.username}
                                  </span>
                                  {targetUser.profile?.isPro && <ProBadge size="sm" />}
                                </div>
                                <span className="admin-user-handle">@{targetUser.username}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="admin-email-cell">
                              <span>{targetUser.email}</span>
                              {targetUser.emailVerified ? (
                                <span className="admin-verified-tag" title="Verified Email">
                                  <CheckCircleIcon size={12} />
                                </span>
                              ) : (
                                <span className="admin-unverified-tag" title="Unverified Email">
                                  Unverified
                                </span>
                              )}
                            </div>
                          </td>

                          <td>{renderRoleBadge(targetUser.role)}</td>

                          <td>{renderStatusBadge(targetUser.status, targetUser.banReason, targetUser.restriction)}</td>

                          <td>
                            <span className="admin-date-text">
                              {new Date(targetUser.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-action-btn admin-action-view"
                                onClick={() => handleOpenUserDetails(targetUser)}
                                title="View detailed profile and stats"
                              >
                                <EyeIcon size={15} />
                                <span>Details</span>
                              </button>

                              {!isBanned && (
                                !isRestricted ? (
                                  <button
                                    type="button"
                                    className="admin-action-btn admin-action-restrict"
                                    onClick={() => handleOpenRestrictModal(targetUser)}
                                    disabled={isSelf || isTargetAdmin}
                                    title={
                                      isSelf
                                        ? "You cannot restrict yourself"
                                        : isTargetAdmin
                                        ? "Cannot restrict another administrator"
                                        : "Restrict platform interactions"
                                    }
                                  >
                                    <AlertCircleIcon size={15} />
                                    <span>Restrict</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="admin-action-btn admin-action-unrestrict"
                                    onClick={() => handleOpenUnrestrictModal(targetUser)}
                                    title="Lift interaction restrictions"
                                  >
                                    <CheckCircleIcon size={15} />
                                    <span>Unrestrict</span>
                                  </button>
                                )
                              )}

                              {!isBanned ? (
                                <button
                                  type="button"
                                  className="admin-action-btn admin-action-ban"
                                  onClick={() => handleOpenBanModal(targetUser)}
                                  disabled={isSelf || isTargetAdmin}
                                  title={
                                    isSelf
                                      ? "You cannot ban yourself"
                                      : isTargetAdmin
                                      ? "Cannot ban another administrator"
                                      : "Globally ban user"
                                  }
                                >
                                  <BanIcon size={15} />
                                  <span>Ban</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-action-btn admin-action-unban"
                                  onClick={() => handleOpenUnbanModal(targetUser)}
                                  title="Restore active account status"
                                >
                                  <CheckCircleIcon size={15} />
                                  <span>Unban</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {usersTotalPages > 1 && (
              <div className="admin-pagination-bar">
                <span className="admin-pagination-info">
                  Showing Page {usersPage} of {usersTotalPages} ({usersTotal} users)
                </span>
                <div className="admin-pagination-btns">
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setUsersPage((p) => Math.max(p - 1, 1))}
                    disabled={usersPage <= 1 || usersLoading}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setUsersPage((p) => Math.min(p + 1, usersTotalPages))}
                    disabled={usersPage >= usersTotalPages || usersLoading}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TARGETED PRIVATE MESSAGE REVIEW */}
      {/* ========================================================================= */}
      {activeTab === "pm-review" && (
        <section className="admin-tab-section" aria-label="Private Message Review">
          {/* Exceptional Administrative Action Warning Banner */}
          <div className="admin-warning-card glass-panel">
            <div className="admin-warning-icon-wrapper">
              <AlertCircleIcon size={28} className="admin-warning-icon" />
            </div>
            <div className="admin-warning-content">
              <h3>Exceptional Administrative Action Warning</h3>
              <p>
                Private message review is strictly restricted to platform administrators with legitimate legal, security, or compliance necessity.
                Every retrieval action is <strong>permanently logged</strong> in the immutable audit trail with your Admin ID (<strong>@{user?.username}</strong>), timestamp, IP address, and mandatory justification.
              </p>
              <span className="admin-warning-subnote">
                Unjustified review of private user communications violates ANOY privacy standards.
              </span>
            </div>
          </div>

          {!reviewData ? (
            <div className="pm-review-setup-flow">
              {/* Step 1: User Lookup & Search */}
              <div className="admin-section-card glass-panel">
                <div className="admin-card-header">
                  <h3>1. Select Target User</h3>
                  <p>Search for a user by @username or email to inspect their private conversation threads.</p>
                </div>

                {!pmSelectedUser ? (
                  <div className="pm-user-lookup-container">
                    <form onSubmit={handleSearchPmUser} className="admin-search-form">
                      <div className="admin-search-input-wrapper">
                        <SearchIcon size={18} className="admin-search-icon" />
                        <input
                          type="text"
                          placeholder="Search user by @username or email..."
                          value={pmUserSearchQuery}
                          onChange={(e) => setPmUserSearchQuery(e.target.value)}
                          className="admin-search-input"
                        />
                        {pmUserSearchQuery && (
                          <button
                            type="button"
                            className="admin-clear-input-btn"
                            onClick={() => {
                              setPmUserSearchQuery("");
                              setPmUserSearchResults([]);
                            }}
                            aria-label="Clear search"
                          >
                            <XIcon size={16} />
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="admin-btn admin-btn-primary"
                        disabled={pmUserSearchLoading || !pmUserSearchQuery.trim()}
                      >
                        {pmUserSearchLoading ? <LoaderIcon size={16} className="admin-spin" /> : "Search Users"}
                      </button>
                    </form>

                    {/* Search Results List */}
                    {pmUserSearchResults.length > 0 && (
                      <div className="pm-user-search-results">
                        <div className="pm-results-header">Matching Accounts:</div>
                        <div className="pm-user-cards-grid">
                          {pmUserSearchResults.map((u) => (
                            <div key={u._id} className="pm-user-result-card glass-panel">
                              <div className="pm-user-avatar">
                                {u.profile?.avatar ? (
                                  <img src={u.profile.avatar} alt={u.username} />
                                ) : (
                                  u.username.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="pm-user-details">
                                <div className="pm-user-name-row">
                                  <strong>{u.profile?.displayName || u.username}</strong>
                                  {u.profile?.isPro && <ProBadge size="sm" />}
                                </div>
                                <span className="pm-user-handle">@{u.username}</span>
                                <span className="pm-user-email">{u.email}</span>
                                <div className="pm-user-tags">
                                  {renderRoleBadge(u.role)}
                                  {renderStatusBadge(u.status, u.banReason, u.restriction)}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="admin-btn admin-btn-ghost pm-select-user-btn"
                                onClick={() => handleSelectPmUser(u)}
                              >
                                Select User
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected User Header Card */
                  <div className="pm-selected-user-card glass-panel">
                    <div className="pm-selected-user-left">
                      <div className="pm-user-avatar-lg">
                        {pmSelectedUser.profile?.avatar ? (
                          <img src={pmSelectedUser.profile.avatar} alt={pmSelectedUser.username} />
                        ) : (
                          pmSelectedUser.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="pm-selected-user-info">
                        <div className="pm-user-name-row">
                          <h4>{pmSelectedUser.profile?.displayName || pmSelectedUser.username}</h4>
                          {pmSelectedUser.profile?.isPro && <ProBadge size="sm" />}
                        </div>
                        <span className="pm-user-handle-lg">@{pmSelectedUser.username} &bull; {pmSelectedUser.email}</span>
                        <div className="pm-user-tags" style={{ marginTop: 4 }}>
                          {renderRoleBadge(pmSelectedUser.role)}
                          {renderStatusBadge(pmSelectedUser.status, pmSelectedUser.banReason, pmSelectedUser.restriction)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={handleClearPmUser}
                    >
                      <XIcon size={16} />
                      <span>Change User</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Conversations List for Selected User */}
              {pmSelectedUser && (
                <div className="admin-section-card glass-panel">
                  <div className="admin-card-header">
                    <h3>2. Select Conversation</h3>
                    <p>Select the specific conversation thread to review.</p>
                  </div>

                  {pmConversationsLoading ? (
                    <div className="admin-loading-state" style={{ minHeight: 140 }}>
                      <LoaderIcon size={28} className="admin-spin" />
                      <p>Loading conversation threads for @{pmSelectedUser.username}...</p>
                    </div>
                  ) : pmConversations.length === 0 ? (
                    <div className="admin-empty-state" style={{ padding: 24 }}>
                      <MessageCircleIcon size={36} className="admin-empty-icon" />
                      <h4>No Conversations Found</h4>
                      <p>@{pmSelectedUser.username} does not currently have any private 1-to-1 conversations.</p>
                    </div>
                  ) : (
                    <div className="pm-conversations-grid">
                      {pmConversations.map((conv) => {
                        const isSelected = pmSelectedConversation?._id === conv._id;
                        const otherParticipants = conv.participants.filter(
                          (p) => p._id !== pmSelectedUser._id
                        );
                        const otherUser = otherParticipants[0] || conv.participants[0];

                        return (
                          <div
                            key={conv._id}
                            className={`pm-conv-card glass-panel ${isSelected ? "selected-conv" : ""}`}
                            onClick={() => {
                              setPmSelectedConversation(conv);
                              setShowManualConvId(false);
                            }}
                          >
                            <div className="pm-conv-card-top">
                              <div className="pm-conv-avatar">
                                {otherUser?.avatar ? (
                                  <img src={otherUser.avatar} alt={otherUser.username} />
                                ) : (
                                  (otherUser?.username || "U").charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="pm-conv-user-info">
                                <div className="pm-user-name-row">
                                  <strong>{otherUser?.displayName || otherUser?.username}</strong>
                                  {otherUser?.isPro && <ProBadge size="sm" />}
                                </div>
                                <span className="pm-conv-handle">@{otherUser?.username}</span>
                              </div>
                              <div className="pm-conv-status-tags">
                                {renderRoleBadge(otherUser?.role || "USER")}
                                {otherUser?.status === "BANNED" && <span className="pill-banned">BANNED</span>}
                              </div>
                            </div>

                            <div className="pm-conv-preview-box">
                              <span className="pm-conv-preview-label">Last Message:</span>
                              <p className="pm-conv-snippet">
                                {conv.lastMessage?.content
                                  ? conv.lastMessage.content
                                  : conv.lastMessage?.mediaUrl
                                  ? "📷 [Attachment]"
                                  : "No messages yet"}
                              </p>
                            </div>

                            <div className="pm-conv-card-bottom">
                              <span className="pm-conv-time">
                                Active: {formatDate(conv.lastMessageAt || conv.updatedAt)}
                              </span>
                              <button
                                type="button"
                                className={`admin-btn ${isSelected ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                style={{ fontSize: 12, padding: "5px 12px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPmSelectedConversation(conv);
                                  setShowManualConvId(false);
                                }}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckIcon size={14} />
                                    <span>Selected</span>
                                  </>
                                ) : (
                                  "Select"
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Manual Fallback Toggle */}
              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="text-link-btn"
                  style={{ fontSize: 12, color: "var(--text-muted)" }}
                  onClick={() => {
                    setShowManualConvId(!showManualConvId);
                    if (!showManualConvId) {
                      setPmSelectedConversation(null);
                    }
                  }}
                >
                  {showManualConvId ? "Hide Manual Conversation ID Entry" : "Or Enter Raw Conversation ID Directly"}
                </button>
              </div>

              {showManualConvId && (
                <div className="admin-section-card glass-panel" style={{ borderStyle: "dashed" }}>
                  <div className="admin-form-group">
                    <label htmlFor="manual-conv-id">Direct Conversation ID</label>
                    <input
                      id="manual-conv-id"
                      type="text"
                      placeholder="e.g. 64f8a12b..."
                      value={manualConvId}
                      onChange={(e) => {
                        setManualConvId(e.target.value);
                        if (e.target.value.trim()) {
                          setPmSelectedConversation(null);
                        }
                      }}
                      className="admin-input-full"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Authorization & Mandatory Reason */}
              {(pmSelectedConversation || (showManualConvId && manualConvId.trim())) && (
                <div className="admin-section-card glass-panel pm-authorization-card">
                  <div className="admin-card-header">
                    <h3>3. Authorize Private Message Access</h3>
                    <p>Enter a mandatory administrative justification to retrieve and inspect this conversation.</p>
                  </div>

                  <form onSubmit={handleStartReview} className="admin-form">
                    {pmSelectedConversation && (
                      <div className="pm-selected-conv-summary">
                        <div className="summary-item">
                          <span className="summary-label">Target Conversation ID:</span>
                          <span className="summary-value mono-text">{pmSelectedConversation._id}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">Participants:</span>
                          <span className="summary-value">
                            {pmSelectedConversation.participants.map((p) => `@${p.username}`).join(" & ")}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="admin-form-group">
                      <label htmlFor="review-reason">
                        Mandatory Administrative Justification <span className="required-star">*</span>
                      </label>
                      <textarea
                        id="review-reason"
                        rows={3}
                        placeholder="Document the exact security ticket, safety report ID, or legal compliance inquiry justifying this access..."
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        required
                        className="admin-textarea-full"
                        autoFocus
                      />
                      <small className="admin-field-hint">
                        This stated reason will be permanently recorded in the immutable platform audit trail alongside your Admin ID and timestamp.
                      </small>
                    </div>

                    <div className="admin-action-row">
                      <button
                        type="submit"
                        className="admin-btn admin-btn-danger glow-button"
                        disabled={
                          reviewLoading ||
                          (!pmSelectedConversation && !manualConvId.trim()) ||
                          !reviewReason.trim()
                        }
                      >
                        {reviewLoading ? (
                          <>
                            <LoaderIcon size={18} className="admin-spin" />
                            <span>Authorizing & Retrieving Messages...</span>
                          </>
                        ) : (
                          <>
                            <LockIcon size={18} />
                            <span>Access & Review Private Messages</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Active Review Session View */
            <div className="admin-review-active-card glass-panel">
              <div className="admin-review-header-bar">
                <div className="admin-review-meta">
                  <div className="admin-active-badge">
                    <span className="admin-pulse-dot"></span>
                    ACTIVE REVIEW SESSION
                  </div>
                  <h3>Conversation ID: {reviewData.conversation?._id}</h3>
                  <div className="admin-participants-list">
                    <strong>Participants:</strong>{" "}
                    {reviewData.conversation?.participants?.map((p) => (
                      <span key={p._id} className="admin-participant-pill">
                        @{p.username} ({p.role}) {p.status === "BANNED" && <span className="pill-banned">BANNED</span>}
                      </span>
                    ))}
                  </div>
                  <span className="admin-review-total-count">
                    Total Messages: {reviewData.total}
                  </span>
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={handleEndReview}
                >
                  <XIcon size={18} />
                  <span>End Review Session</span>
                </button>
              </div>

              {/* Messages Stream */}
              <div className="admin-messages-stream">
                {reviewData.messages?.length === 0 ? (
                  <div className="admin-empty-state">
                    <MessageCircleIcon size={36} />
                    <p>No messages found in this conversation.</p>
                  </div>
                ) : (
                  reviewData.messages?.map((msg) => {
                    const isSystem = msg.type === "system";
                    return (
                      <div
                        key={msg._id}
                        className={`admin-message-item ${isSystem ? "msg-system" : ""}`}
                      >
                        <div className="admin-message-meta">
                          <span className="admin-message-sender">
                            {msg.sender?.username ? `@${msg.sender.username}` : "System"}
                          </span>
                          <span className="admin-message-time">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>

                        <div className="admin-message-body">
                          {msg.content}
                          {msg.mediaUrl && (
                            <div className="admin-message-media">
                              <img
                                src={msg.mediaUrl}
                                alt="Attachment"
                                className="admin-msg-image"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Review Pagination if applicable */}
              {reviewData.totalPages > 1 && (
                <div className="admin-pagination-bar">
                  <span className="admin-pagination-info">
                    Page {reviewData.page} of {reviewData.totalPages} ({reviewData.total} total messages)
                  </span>
                  <div className="admin-pagination-btns">
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => handleStartReview(null, Math.max(reviewPage - 1, 1))}
                      disabled={reviewPage <= 1 || reviewLoading}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() =>
                        handleStartReview(null, Math.min(reviewPage + 1, reviewData.totalPages))
                      }
                      disabled={reviewPage >= reviewData.totalPages || reviewLoading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PLATFORM AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === "audit-logs" && (
        <section className="admin-tab-section" aria-label="Platform Audit Logs">
          {/* Audit Filter Bar */}
          <div className="admin-filter-bar glass-panel">
            <div className="admin-filter-dropdowns" style={{ width: "100%" }}>
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="admin-select"
                aria-label="Filter by Action"
              >
                <option value="">All Administrative Actions</option>
                <option value="USER_BAN">USER_BAN</option>
                <option value="USER_UNBAN">USER_UNBAN</option>
                <option value="USER_RESTRICT">USER_RESTRICT</option>
                <option value="USER_UNRESTRICT">USER_UNRESTRICT</option>
                <option value="PRIVATE_MESSAGE_REVIEW">PRIVATE_MESSAGE_REVIEW</option>
              </select>

              {auditActionFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditActionFilter("");
                    setAuditPage(1);
                  }}
                  className="admin-btn admin-btn-ghost"
                >
                  Clear Action Filter
                </button>
              )}
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="admin-table-container glass-panel">
            {auditLoading ? (
              <div className="admin-loading-state">
                <LoaderIcon size={36} className="admin-spin" />
                <p>Loading immutable platform audit logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="admin-empty-state">
                <ClockIcon size={48} className="admin-empty-icon" />
                <h3>No Audit Logs Recorded</h3>
                <p>No administrative operations matched the active filter.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Stated Justification / Reason</th>
                      <th>IP & Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      const actionColorClass =
                        log.action === "USER_BAN"
                          ? "badge-danger"
                          : log.action === "USER_UNBAN"
                          ? "badge-success"
                          : log.action === "USER_RESTRICT"
                          ? "badge-warning"
                          : log.action === "USER_UNRESTRICT"
                          ? "badge-info"
                          : "badge-purple";

                      return (
                        <tr key={log._id}>
                          <td>
                            <span className="admin-date-text">{formatDate(log.createdAt)}</span>
                          </td>

                          <td>
                            <div className="admin-log-admin-cell">
                              <strong>@{log.admin?.username || "Unknown"}</strong>
                              <span className="admin-subtext">{log.admin?.email}</span>
                            </div>
                          </td>

                          <td>
                            <span className={`admin-action-pill ${actionColorClass}`}>
                              {log.action}
                            </span>
                          </td>

                          <td>
                            <div className="admin-log-target-cell">
                              {log.targetUser && (
                                <span>User: @{log.targetUser.username}</span>
                              )}
                              {log.targetConversation && (
                                <span>Conv: {log.targetConversation}</span>
                              )}
                              {log.targetUsers?.length > 0 && !log.targetUser && (
                                <span>
                                  Users: {log.targetUsers.map((u) => `@${u.username}`).join(", ")}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <p className="admin-log-reason-text">{log.reason || "None specified"}</p>
                          </td>

                          <td>
                            <div className="admin-log-meta-cell">
                              {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                              {log.metadata?.messagesReviewedCount !== undefined && (
                                <span>Messages: {log.metadata.messagesReviewedCount}</span>
                              )}
                              {log.metadata?.previousStatus && (
                                <span>Prev Status: {log.metadata.previousStatus}</span>
                              )}
                              {log.metadata?.duration && (
                                <span>Duration: {log.metadata.duration}</span>
                              )}
                              {log.metadata?.expiresAt && (
                                <span>Expires: {formatDate(log.metadata.expiresAt)}</span>
                              )}
                              {log.metadata?.isPermanent && (
                                <span>Type: Permanent</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {auditTotalPages > 1 && (
              <div className="admin-pagination-bar">
                <span className="admin-pagination-info">
                  Page {auditPage} of {auditTotalPages} ({auditTotal} total logs)
                </span>
                <div className="admin-pagination-btns">
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                    disabled={auditPage <= 1 || auditLoading}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => setAuditPage((p) => Math.min(p + 1, auditTotalPages))}
                    disabled={auditPage >= auditTotalPages || auditLoading}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL: USER DETAILS */}
      {/* ========================================================================= */}
      {selectedUserModal && (
        <div className="modal-backdrop" onClick={() => setSelectedUserModal(null)}>
          <div className="modal-container admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Platform User Profile</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedUserModal(null)}
                aria-label="Close user details modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            {loadingUserDetails ? (
              <div className="admin-loading-state" style={{ minHeight: 200 }}>
                <LoaderIcon size={32} className="admin-spin" />
                <p>Loading full profile and metadata...</p>
              </div>
            ) : userDetails ? (
              <div className="admin-user-details-body">
                {/* Header Card */}
                <div className="admin-user-profile-header glass-panel">
                  <div className="admin-profile-avatar-lg">
                    {userDetails.profile?.avatar ? (
                      <img src={userDetails.profile.avatar} alt={userDetails.username} />
                    ) : (
                      userDetails.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="admin-profile-header-info">
                    <div className="admin-profile-title-line">
                      <h3>{userDetails.profile?.displayName || userDetails.username}</h3>
                      {userDetails.profile?.isPro && <ProBadge size="sm" />}
                    </div>
                    <span className="admin-handle-lg">@{userDetails.username}</span>
                    <p className="admin-bio-text">{userDetails.profile?.bio || "No bio set."}</p>
                  </div>
                  <div className="admin-profile-status-pills">
                    {renderRoleBadge(userDetails.role)}
                    {renderStatusBadge(userDetails.status, userDetails.banReason, userDetails.restriction)}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="admin-details-grid">
                  <div className="admin-detail-item">
                    <span className="detail-label">Account ID</span>
                    <span className="detail-value mono-text">{userDetails._id}</span>
                  </div>
                  <div className="admin-detail-item">
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value">
                      {userDetails.email}{" "}
                      {userDetails.emailVerified ? (
                        <span className="admin-verified-tag">Verified</span>
                      ) : (
                        <span className="admin-unverified-tag">Unverified</span>
                      )}
                    </span>
                  </div>
                  <div className="admin-detail-item">
                    <span className="detail-label">Total Posts</span>
                    <span className="detail-value">{userDetails.postCount ?? 0}</span>
                  </div>
                  <div className="admin-detail-item">
                    <span className="detail-label">Account Visibility</span>
                    <span className="detail-value">{userDetails.profile?.privacy || "PUBLIC"}</span>
                  </div>
                  <div className="admin-detail-item">
                    <span className="detail-label">Registered At</span>
                    <span className="detail-value">{formatDate(userDetails.createdAt)}</span>
                  </div>
                  <div className="admin-detail-item">
                    <span className="detail-label">Last Login</span>
                    <span className="detail-value">{formatDate(userDetails.lastLogin)}</span>
                  </div>
                </div>

                {/* Restriction Status Info if Restricted */}
                {userDetails.restriction?.isRestricted && (
                  <div className="admin-restriction-info-card">
                    <h4>Interaction Restriction Active</h4>
                    <p>
                      <strong>Reason:</strong> {userDetails.restriction.reason || "Administrative restriction"}
                    </p>
                    <p>
                      <strong>Duration:</strong>{" "}
                      {userDetails.restriction.expiresAt
                        ? `Expires on ${formatDate(userDetails.restriction.expiresAt)}`
                        : "Permanent"}
                    </p>
                    <p>
                      <strong>Restricted At:</strong> {formatDate(userDetails.restriction.restrictedAt)}
                    </p>
                    {userDetails.restriction.restrictedBy && (
                      <p>
                        <strong>Enforced By:</strong> @{userDetails.restriction.restrictedBy.username || userDetails.restriction.restrictedBy}
                      </p>
                    )}
                  </div>
                )}

                {/* Ban Status Info if Banned */}
                {userDetails.status === "BANNED" && (
                  <div className="admin-ban-info-card">
                    <h4>Ban Enforcement Details</h4>
                    <p>
                      <strong>Reason:</strong> {userDetails.banReason || "No reason recorded"}
                    </p>
                    <p>
                      <strong>Banned At:</strong> {formatDate(userDetails.bannedAt)}
                    </p>
                    {userDetails.bannedBy && (
                      <p>
                        <strong>Enforced By:</strong> @{userDetails.bannedBy.username} ({userDetails.bannedBy.email})
                      </p>
                    )}
                  </div>
                )}

                {/* Actions Footer inside modal */}
                <div className="modal-footer" style={{ marginTop: 24, display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setSelectedUserModal(null)}
                  >
                    Close
                  </button>

                  {userDetails.status !== "BANNED" && (
                    !userDetails.restriction?.isRestricted ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-warning"
                        onClick={() => {
                          setSelectedUserModal(null);
                          handleOpenRestrictModal(userDetails);
                        }}
                        disabled={
                          userDetails._id === user?._id || userDetails.role === "ADMIN"
                        }
                      >
                        <AlertCircleIcon size={16} />
                        <span>Restrict Interactions</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn-info"
                        onClick={() => {
                          setSelectedUserModal(null);
                          handleOpenUnrestrictModal(userDetails);
                        }}
                      >
                        <CheckCircleIcon size={16} />
                        <span>Remove Restriction</span>
                      </button>
                    )
                  )}

                  {userDetails.status !== "BANNED" ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() => {
                        setSelectedUserModal(null);
                        handleOpenBanModal(userDetails);
                      }}
                      disabled={
                        userDetails._id === user?._id || userDetails.role === "ADMIN"
                      }
                    >
                      <BanIcon size={16} />
                      <span>Ban Account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn-success"
                      onClick={() => {
                        setSelectedUserModal(null);
                        handleOpenUnbanModal(userDetails);
                      }}
                    >
                      <CheckCircleIcon size={16} />
                      <span>Unban Account</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESTRICT USER */}
      {/* ========================================================================= */}
      {restrictModalUser && (
        <div className="modal-backdrop" onClick={() => setRestrictModalUser(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "var(--warning, #f59e0b)" }}>
                Restrict User: @{restrictModalUser.username}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRestrictModalUser(null)}
                aria-label="Close restrict modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmRestrict} className="modal-form">
              <div className="admin-restriction-warning-note">
                <AlertCircleIcon size={20} className="text-warning" />
                <div>
                  <strong>Read-Only Platform Restriction</strong>
                  <p>
                    Restricted users <strong>can sign in and view</strong> feed, posts, and public profiles, but <strong>cannot</strong> create posts, comment, like, react, send private messages, or chat in communities.
                  </p>
                </div>
              </div>

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <label htmlFor="restrict-duration-select">Restriction Duration</label>
                <select
                  id="restrict-duration-select"
                  value={restrictDuration}
                  onChange={(e) => setRestrictDuration(e.target.value)}
                  className="admin-select-full"
                >
                  <option value="1h">1 Hour (Quick timeout)</option>
                  <option value="24h">24 Hours (1 Day)</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days (1 Week)</option>
                  <option value="30d">30 Days (1 Month)</option>
                  <option value="permanent">Permanent (Until manual lift)</option>
                  <option value="custom">Custom Date & Time</option>
                </select>
              </div>

              {restrictDuration === "custom" && (
                <div className="admin-form-group" style={{ marginTop: 12 }}>
                  <label htmlFor="restrict-custom-date">
                    Custom Expiration Date & Time <span className="required-star">*</span>
                  </label>
                  <input
                    id="restrict-custom-date"
                    type="datetime-local"
                    value={restrictCustomDate}
                    onChange={(e) => setRestrictCustomDate(e.target.value)}
                    required
                    className="admin-input-full"
                  />
                </div>
              )}

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <label htmlFor="restrict-reason-input">
                  Mandatory Restriction Reason <span className="required-star">*</span>
                </label>
                <textarea
                  id="restrict-reason-input"
                  rows={3}
                  placeholder="State the behavior, spam activity, or violation justifying interaction restrictions..."
                  value={restrictReason}
                  onChange={(e) => setRestrictReason(e.target.value)}
                  required
                  className="admin-textarea-full"
                  autoFocus
                />
                <small className="admin-field-hint">
                  This justification will be displayed to the user when blocked and permanently recorded in the audit trail.
                </small>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setRestrictModalUser(null)}
                  disabled={restrictSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-warning glow-button"
                  disabled={restrictSubmitting || !restrictReason.trim() || (restrictDuration === "custom" && !restrictCustomDate)}
                >
                  {restrictSubmitting ? (
                    <>
                      <LoaderIcon size={16} className="admin-spin" />
                      <span>Applying Restriction...</span>
                    </>
                  ) : (
                    <span>Apply Restriction</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UNRESTRICT USER */}
      {/* ========================================================================= */}
      {unrestrictModalUser && (
        <div className="modal-backdrop" onClick={() => setUnrestrictModalUser(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "#10b981" }}>
                Remove Restriction: @{unrestrictModalUser.username}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setUnrestrictModalUser(null)}
                aria-label="Close unrestrict modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmUnrestrict} className="modal-form">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                Lifting interaction restrictions will allow <strong>@{unrestrictModalUser.username}</strong> to create posts, comment, like, and message normally.
              </p>

              {unrestrictModalUser.restriction?.reason && (
                <div className="admin-restriction-info-card" style={{ margin: "12px 0" }}>
                  <small>Active Restriction Reason:</small>
                  <p style={{ margin: 0, fontWeight: 500 }}>{unrestrictModalUser.restriction.reason}</p>
                </div>
              )}

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <label htmlFor="unrestrict-reason-input">Unrestrict Reason / Audit Note</label>
                <input
                  id="unrestrict-reason-input"
                  type="text"
                  placeholder="e.g. Warning acknowledged, timeout completed, etc."
                  value={unrestrictReason}
                  onChange={(e) => setUnrestrictReason(e.target.value)}
                  className="admin-input-full"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setUnrestrictModalUser(null)}
                  disabled={unrestrictSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-success glow-button"
                  disabled={unrestrictSubmitting}
                >
                  {unrestrictSubmitting ? (
                    <>
                      <LoaderIcon size={16} className="admin-spin" />
                      <span>Lifting Restriction...</span>
                    </>
                  ) : (
                    <span>Confirm Unrestrict</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GLOBAL BAN USER */}
      {/* ========================================================================= */}
      {banModalUser && (
        <div className="modal-backdrop" onClick={() => setBanModalUser(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "#ef4444" }}>
                Global Ban User: @{banModalUser.username}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBanModalUser(null)}
                aria-label="Close ban modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmBan} className="modal-form">
              <div className="admin-ban-warning-note">
                <AlertCircleIcon size={20} className="text-danger" />
                <div>
                  <strong>Immediate Session Invalidation</strong>
                  <p>
                    This action will immediately revoke all active JWT tokens, disconnect live Socket.IO connections, and prevent any future sign-ins for <strong>@{banModalUser.username}</strong> ({banModalUser.email}).
                  </p>
                </div>
              </div>

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <label htmlFor="ban-reason-input">
                  Mandatory Ban Reason <span className="required-star">*</span>
                </label>
                <textarea
                  id="ban-reason-input"
                  rows={4}
                  placeholder="State the exact terms violation, safety issue, or administrative justification..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  required
                  className="admin-textarea-full"
                  autoFocus
                />
                <small className="admin-field-hint">
                  This justification will be displayed to the user upon failed login and recorded in the audit trail.
                </small>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setBanModalUser(null)}
                  disabled={banSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-danger glow-button"
                  disabled={banSubmitting || !banReason.trim()}
                >
                  {banSubmitting ? (
                    <>
                      <LoaderIcon size={16} className="admin-spin" />
                      <span>Enforcing Ban...</span>
                    </>
                  ) : (
                    <span>Confirm Global Ban</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UNBAN USER */}
      {/* ========================================================================= */}
      {unbanModalUser && (
        <div className="modal-backdrop" onClick={() => setUnbanModalUser(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "#10b981" }}>
                Unban Account: @{unbanModalUser.username}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setUnbanModalUser(null)}
                aria-label="Close unban modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmUnban} className="modal-form">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                Restoring active status will allow <strong>@{unbanModalUser.username}</strong> to sign in and use the platform normally.
              </p>

              {unbanModalUser.banReason && (
                <div className="admin-ban-info-card" style={{ margin: "12px 0" }}>
                  <small>Previous Ban Reason:</small>
                  <p style={{ margin: 0, fontWeight: 500 }}>{unbanModalUser.banReason}</p>
                </div>
              )}

              <div className="admin-form-group" style={{ marginTop: 16 }}>
                <label htmlFor="unban-reason-input">Unban Reason / Audit Note</label>
                <input
                  id="unban-reason-input"
                  type="text"
                  placeholder="e.g. Appeal granted, error resolved, etc."
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  className="admin-input-full"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setUnbanModalUser(null)}
                  disabled={unbanSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-success glow-button"
                  disabled={unbanSubmitting}
                >
                  {unbanSubmitting ? (
                    <>
                      <LoaderIcon size={16} className="admin-spin" />
                      <span>Restoring Account...</span>
                    </>
                  ) : (
                    <span>Confirm Unban</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
