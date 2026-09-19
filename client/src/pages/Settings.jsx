import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { settingsApi, authApi } from "../services/api";
import {
  UserIcon,
  LockIcon,
  BellIcon,
  ShieldIcon,
  BanIcon,
  TrashIcon,
  LogOutIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  LoaderIcon,
  CheckCircleIcon,
  SparklesIcon,
  KeyIcon,
  GlobeIcon
} from "../components/Icons";
import ProBadge from "../components/ProBadge";

function Settings() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get("tab") || "account";

  // Data Loading State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsData, setSettingsData] = useState(null);

  // Account State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: request OTP, 2: enter OTP & new pass
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  // Privacy State
  const [privacy, setPrivacy] = useState("PUBLIC");
  const [messagePrivacy, setMessagePrivacy] = useState("EVERYONE");

  // Notification State
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    communities: true
  });

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockUsernameInput, setBlockUsernameInput] = useState("");
  const [blockingBusy, setBlockingBusy] = useState(false);

  // Security State
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  // Danger Zone State
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Load Settings from Backend
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getSettings();
      if (res.data.success && res.data.settings) {
        setSettingsData(res.data.settings);
        setPrivacy(res.data.settings.privacy?.privacy || "PUBLIC");
        setMessagePrivacy(res.data.settings.privacy?.messagePrivacy || "EVERYONE");
        if (res.data.settings.notifications) {
          setNotifications(res.data.settings.notifications);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      addToast(err.response?.data?.message || "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Load Blocked Users
  const fetchBlockedUsers = useCallback(async () => {
    try {
      const res = await settingsApi.getBlockedUsers();
      if (res.data.success) {
        setBlockedUsers(res.data.blockedUsers || []);
      }
    } catch (err) {
      console.error("Failed to load blocked users:", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchBlockedUsers();
  }, [fetchSettings, fetchBlockedUsers]);

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast("Please fill in all password fields", "error");
      return;
    }
    if (newPassword.length < 8) {
      addToast("New password must be at least 8 characters long", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("New passwords do not match", "error");
      return;
    }

    try {
      setSaving(true);
      const res = await settingsApi.changePassword({ currentPassword, newPassword });
      if (res.data.success) {
        addToast("Password changed successfully!", "success");
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to update password", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handle Forgot Password Flow
  const handleRequestForgotOtp = async (e) => {
    e.preventDefault();
    const emailToUse = forgotEmail.trim() || user?.email;
    if (!emailToUse) {
      addToast("Please enter your account email address", "error");
      return;
    }

    try {
      setForgotBusy(true);
      const res = await authApi.forgotPassword({ email: emailToUse });
      if (res.data.success) {
        addToast("Verification code sent to your email!", "success");
        setForgotStep(2);
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to send reset code", "error");
    } finally {
      setForgotBusy(false);
    }
  };

  const handleResetPasswordWithOtp = async (e) => {
    e.preventDefault();
    const emailToUse = forgotEmail.trim() || user?.email;
    if (!forgotOtp.trim() || !forgotNewPass) {
      addToast("Please enter the 6-digit OTP and new password", "error");
      return;
    }
    if (forgotNewPass.length < 8) {
      addToast("Password must be at least 8 characters", "error");
      return;
    }

    try {
      setForgotBusy(true);
      const res = await authApi.resetPassword({
        email: emailToUse,
        otp: forgotOtp.trim(),
        newPassword: forgotNewPass
      });
      if (res.data.success) {
        addToast("Password reset successfully! Please log in with your new password.", "success");
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotOtp("");
        setForgotNewPass("");
        logout();
        navigate("/login");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Invalid or expired reset code", "error");
    } finally {
      setForgotBusy(false);
    }
  };

  // Handle Privacy Save
  const handleSavePrivacy = async () => {
    try {
      setSaving(true);
      const res = await settingsApi.updatePrivacy({ privacy, messagePrivacy });
      if (res.data.success) {
        addToast("Privacy settings updated!", "success");
        if (refreshProfile) refreshProfile();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to update privacy settings", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handle Notifications Save
  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      const res = await settingsApi.updateNotifications(notifications);
      if (res.data.success) {
        addToast("Notification preferences updated!", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to update notifications", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handle Block User
  const handleBlockUser = async (e) => {
    e.preventDefault();
    const target = blockUsernameInput.trim().replace(/^@/, "");
    if (!target) {
      addToast("Please enter a valid username", "error");
      return;
    }
    if (target.toLowerCase() === user?.username?.toLowerCase()) {
      addToast("You cannot block yourself", "error");
      return;
    }

    try {
      setBlockingBusy(true);
      const res = await settingsApi.blockUser(target);
      if (res.data.success) {
        addToast(`@${target} has been blocked`, "success");
        setBlockUsernameInput("");
        fetchBlockedUsers();
      }
    } catch (err) {
      addToast(err.response?.data?.message || `Failed to block @${target}`, "error");
    } finally {
      setBlockingBusy(false);
    }
  };

  // Handle Unblock User
  const handleUnblockUser = async (username) => {
    try {
      const res = await settingsApi.unblockUser(username);
      if (res.data.success) {
        addToast(`@${username} has been unblocked`, "info");
        setBlockedUsers((prev) => prev.filter((b) => b.username !== username));
      }
    } catch (err) {
      addToast(err.response?.data?.message || `Failed to unblock @${username}`, "error");
    }
  };

  // Handle Logout All Devices
  const handleLogoutAll = async () => {
    const confirm = window.confirm(
      "Are you sure you want to log out of all active devices? You will be signed out immediately."
    );
    if (!confirm) return;

    try {
      setLogoutAllBusy(true);
      await settingsApi.logoutAllDevices();
      addToast("Logged out of all devices.", "info");
      logout();
      navigate("/login");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to logout from all devices", "error");
    } finally {
      setLogoutAllBusy(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteConfirmationText !== "DELETE") {
      addToast('Please type "DELETE" to confirm account deletion', "error");
      return;
    }

    const finalConfirm = window.confirm(
      "WARNING: This will permanently deactivate your ANOY profile, soft-delete your posts, and remove your connections. This action cannot be undone. Are you sure?"
    );
    if (!finalConfirm) return;

    try {
      setDeleteBusy(true);
      const res = await settingsApi.deleteAccount({
        password: deletePassword,
        confirmationText: deleteConfirmationText
      });
      if (res.data.success) {
        addToast("Your account has been deleted.", "info");
        logout();
        navigate("/login");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete account", "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="main-feed-column">
      {/* Sticky Header */}
      <header className="sticky-header">
        <h2 className="sticky-header-title">Account & Settings</h2>
      </header>

      <div className="settings-page-container">
        {/* Navigation Tabs */}
        <div className="settings-nav-tabs">
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "account" ? "active" : ""}`}
            onClick={() => handleTabChange("account")}
          >
            <UserIcon size={18} />
            <span>Account</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "privacy" ? "active" : ""}`}
            onClick={() => handleTabChange("privacy")}
          >
            <LockIcon size={18} />
            <span>Privacy</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "notifications" ? "active" : ""}`}
            onClick={() => handleTabChange("notifications")}
          >
            <BellIcon size={18} />
            <span>Notifications</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "blocked" ? "active" : ""}`}
            onClick={() => handleTabChange("blocked")}
          >
            <BanIcon size={18} />
            <span>Blocked</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "security" ? "active" : ""}`}
            onClick={() => handleTabChange("security")}
          >
            <ShieldIcon size={18} />
            <span>Security</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "danger" ? "active" : ""}`}
            onClick={() => handleTabChange("danger")}
          >
            <TrashIcon size={18} />
            <span>Danger Zone</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${currentTab === "about" ? "active" : ""}`}
            onClick={() => handleTabChange("about")}
          >
            <GlobeIcon size={18} />
            <span>About</span>
          </button>
        </div>

        {loading ? (
          <div className="settings-loading-state">
            <LoaderIcon size={32} />
            <p>Loading your preferences...</p>
          </div>
        ) : (
          <div className="settings-tab-content">
            {/* ================= ACCOUNT TAB ================= */}
            {currentTab === "account" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>Account Information</h3>
                  <p>Your core profile credentials and authentication security.</p>
                </div>

                <div className="settings-info-grid">
                  <div className="settings-info-item">
                    <span className="info-label">Username</span>
                    <div className="info-value-row">
                      <span className="info-value">@{user?.username}</span>
                      {profile?.isPro && <ProBadge size="sm" />}
                    </div>
                  </div>

                  <div className="settings-info-item">
                    <span className="info-label">Email Address</span>
                    <div className="info-value-row">
                      <span className="info-value">{user?.email || "No email registered"}</span>
                      {settingsData?.account?.emailVerified ? (
                        <span className="badge-verified">
                          <CheckCircleIcon size={14} /> Verified
                        </span>
                      ) : (
                        <span className="badge-unverified">Pending</span>
                      )}
                    </div>
                  </div>

                  <div className="settings-info-item">
                    <span className="info-label">Account Status</span>
                    <span className="info-value status-active">
                      {settingsData?.account?.status || "ACTIVE"}
                    </span>
                  </div>

                  <div className="settings-info-item">
                    <span className="info-label">Member Since</span>
                    <span className="info-value">
                      {settingsData?.account?.createdAt
                        ? new Date(settingsData.account.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })
                        : "2026"}
                    </span>
                  </div>
                </div>

                <div className="settings-divider" />

                {/* Change Password Sub-form */}
                <div className="settings-card-header">
                  <h3>Change Password</h3>
                  <p>Update your login password regularly to keep your account safe.</p>
                </div>

                <form onSubmit={handleChangePassword} className="settings-form">
                  <div className="settings-form-group">
                    <label>Current Password</label>
                    <div className="input-with-icon-right">
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        placeholder="Enter current password..."
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        aria-label="Toggle password visibility"
                      >
                        {showCurrentPass ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="settings-form-group">
                    <label>New Password (min 8 characters)</label>
                    <div className="input-with-icon-right">
                      <input
                        type={showNewPass ? "text" : "password"}
                        placeholder="Enter new password..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowNewPass(!showNewPass)}
                        aria-label="Toggle password visibility"
                      >
                        {showNewPass ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="settings-form-group">
                    <label>Confirm New Password</label>
                    <div className="input-with-icon-right">
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        placeholder="Confirm new password..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="toggle-pass-btn"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        aria-label="Toggle password visibility"
                      >
                        {showConfirmPass ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="settings-action-row">
                    <button
                      type="submit"
                      className="composer-submit-btn glow-button"
                      disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {saving ? (
                        <>
                          <LoaderIcon size={16} />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="text-link-btn"
                      onClick={() => {
                        setForgotEmail(user?.email || "");
                        setForgotStep(1);
                        setShowForgotModal(true);
                      }}
                    >
                      Forgot password? Reset via OTP
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ================= PRIVACY TAB ================= */}
            {currentTab === "privacy" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>Privacy Settings</h3>
                  <p>Choose who can view your posts and send you direct messages.</p>
                </div>

                <div className="settings-options-group">
                  <h4>Account Visibility</h4>
                  <div className="settings-radio-grid">
                    <div
                      className={`settings-choice-card ${privacy === "PUBLIC" ? "selected" : ""}`}
                      onClick={() => setPrivacy("PUBLIC")}
                    >
                      <div className="choice-header">
                        <GlobeIcon size={20} />
                        <strong>Public Account</strong>
                      </div>
                      <p>Anyone on ANOY can see your posts, media, and profile details.</p>
                    </div>

                    <div
                      className={`settings-choice-card ${privacy === "PRIVATE" ? "selected" : ""}`}
                      onClick={() => setPrivacy("PRIVATE")}
                    >
                      <div className="choice-header">
                        <LockIcon size={20} />
                        <strong>Private Account</strong>
                      </div>
                      <p>Only people you approve as followers can see your posts and profile.</p>
                    </div>
                  </div>
                </div>

                <div className="settings-divider" />

                <div className="settings-options-group">
                  <h4>Direct Messages</h4>
                  <div className="settings-radio-grid">
                    <div
                      className={`settings-choice-card ${messagePrivacy === "EVERYONE" ? "selected" : ""}`}
                      onClick={() => setMessagePrivacy("EVERYONE")}
                    >
                      <div className="choice-header">
                        <strong>Everyone</strong>
                      </div>
                      <p>Any registered user on ANOY can start a conversation with you.</p>
                    </div>

                    <div
                      className={`settings-choice-card ${messagePrivacy === "FOLLOWERS_ONLY" ? "selected" : ""}`}
                      onClick={() => setMessagePrivacy("FOLLOWERS_ONLY")}
                    >
                      <div className="choice-header">
                        <strong>Followers Only</strong>
                      </div>
                      <p>Only users following you can send you direct messages.</p>
                    </div>

                    <div
                      className={`settings-choice-card ${messagePrivacy === "NOBODY" ? "selected" : ""}`}
                      onClick={() => setMessagePrivacy("NOBODY")}
                    >
                      <div className="choice-header">
                        <strong>Nobody</strong>
                      </div>
                      <p>Direct messages are disabled. No one can start new chats with you.</p>
                    </div>
                  </div>
                </div>

                <div className="settings-action-row" style={{ marginTop: 24 }}>
                  <button
                    type="button"
                    className="composer-submit-btn glow-button"
                    disabled={saving}
                    onClick={handleSavePrivacy}
                  >
                    {saving ? (
                      <>
                        <LoaderIcon size={16} />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Privacy Settings</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ================= NOTIFICATIONS TAB ================= */}
            {currentTab === "notifications" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>Notification Preferences</h3>
                  <p>Control what notifications you receive across the platform.</p>
                </div>

                <div className="settings-toggle-list">
                  <div className="settings-toggle-row">
                    <div className="toggle-info">
                      <strong>Post Likes</strong>
                      <p>Notify me when someone likes my posts.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications.likes}
                        onChange={(e) =>
                          setNotifications({ ...notifications, likes: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="settings-toggle-row">
                    <div className="toggle-info">
                      <strong>Comments & Replies</strong>
                      <p>Notify me when someone comments on my posts or replies to my comments.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications.comments}
                        onChange={(e) =>
                          setNotifications({ ...notifications, comments: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="settings-toggle-row">
                    <div className="toggle-info">
                      <strong>New Followers & Requests</strong>
                      <p>Notify me when someone follows me or sends a follow request.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications.follows}
                        onChange={(e) =>
                          setNotifications({ ...notifications, follows: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="settings-toggle-row">
                    <div className="toggle-info">
                      <strong>Direct Messages</strong>
                      <p>Notify me when I receive new direct messages.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications.messages}
                        onChange={(e) =>
                          setNotifications({ ...notifications, messages: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="settings-toggle-row">
                    <div className="toggle-info">
                      <strong>Communities & Study Rooms</strong>
                      <p>Notify me about community announcements and meeting room invites.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications.communities}
                        onChange={(e) =>
                          setNotifications({ ...notifications, communities: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-action-row" style={{ marginTop: 24 }}>
                  <button
                    type="button"
                    className="composer-submit-btn glow-button"
                    disabled={saving}
                    onClick={handleSaveNotifications}
                  >
                    {saving ? (
                      <>
                        <LoaderIcon size={16} />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Notification Preferences</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ================= BLOCKED ACCOUNTS TAB ================= */}
            {currentTab === "blocked" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>Blocked Accounts</h3>
                  <p>Blocked users cannot view your profile, follow you, or message you.</p>
                </div>

                {/* Quick Block Bar */}
                <form onSubmit={handleBlockUser} className="settings-block-form">
                  <input
                    type="text"
                    placeholder="Enter username to block (e.g. rohit)..."
                    value={blockUsernameInput}
                    onChange={(e) => setBlockUsernameInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="composer-submit-btn"
                    style={{ background: "#ef4444", color: "white", border: "none" }}
                    disabled={blockingBusy || !blockUsernameInput.trim()}
                  >
                    {blockingBusy ? <LoaderIcon size={16} /> : "Block User"}
                  </button>
                </form>

                <div className="settings-divider" />

                {/* Blocked List */}
                <div className="settings-blocked-list">
                  {blockedUsers.length > 0 ? (
                    blockedUsers.map((b) => (
                      <div key={b.blockId || b.username} className="settings-blocked-item">
                        <div className="blocked-user-left">
                          <div className="composer-avatar" style={{ width: 40, height: 40 }}>
                            {b.avatar ? (
                              <img src={b.avatar} alt={b.username} />
                            ) : (
                              (b.displayName || b.username).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="blocked-name">{b.displayName || b.username}</div>
                            <div className="blocked-handle">@{b.username}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="composer-submit-btn-sm"
                          onClick={() => handleUnblockUser(b.username)}
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="settings-empty-notice">
                      <p>You haven&apos;t blocked anyone yet.</p>
                      <span>When you block someone, they will appear here.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= SECURITY TAB ================= */}
            {currentTab === "security" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>Security & Active Sessions</h3>
                  <p>Manage your account security and multi-device sessions.</p>
                </div>

                <div className="settings-session-card">
                  <div className="session-icon">
                    <ShieldIcon size={24} style={{ color: "#38bdf8" }} />
                  </div>
                  <div className="session-details">
                    <strong>Current Active Device</strong>
                    <p>Logged in via Web Browser • Authenticated Session</p>
                  </div>
                  <span className="badge-active-session">Current</span>
                </div>

                <div className="settings-divider" />

                <div className="settings-card-header">
                  <h3>Session Invalidation</h3>
                  <p>
                    Lost a device or want to ensure no other sessions remain active?
                    Invalidating sessions will log you out from all phones, tablets, and computers immediately.
                  </p>
                </div>

                <div className="settings-action-row">
                  <button
                    type="button"
                    className="composer-submit-btn"
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                    disabled={logoutAllBusy}
                    onClick={handleLogoutAll}
                  >
                    {logoutAllBusy ? (
                      <LoaderIcon size={16} />
                    ) : (
                      <LogOutIcon size={16} />
                    )}
                    <span>Log Out of All Devices</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= DANGER ZONE TAB ================= */}
            {currentTab === "danger" && (
              <div className="settings-section-card glass-panel settings-danger-panel">
                <div className="settings-card-header">
                  <h3 style={{ color: "#ef4444" }}>Danger Zone: Delete Account</h3>
                  <p>
                    Permanently delete your ANOY account. This action cannot be reversed.
                  </p>
                </div>

                <div className="settings-danger-warning">
                  <AlertCircleIcon size={20} style={{ color: "#ef4444", flexShrink: 0 }} />
                  <div>
                    <strong>Warning:</strong> Deleting your account will immediately revoke all access,
                    hide your posts from the community, remove your followers, and permanently deactivate your username.
                  </div>
                </div>

                <form onSubmit={handleDeleteAccount} className="settings-form" style={{ marginTop: 20 }}>
                  <div className="settings-form-group">
                    <label>Account Password</label>
                    <input
                      type="password"
                      placeholder="Enter your current password..."
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="settings-form-group">
                    <label>
                      Type <strong>DELETE</strong> to confirm
                    </label>
                    <input
                      type="text"
                      placeholder='Type "DELETE"...'
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    />
                  </div>

                  <div className="settings-action-row">
                    <button
                      type="submit"
                      className="composer-submit-btn"
                      style={{
                        background: "#ef4444",
                        color: "white",
                        border: "none"
                      }}
                      disabled={deleteBusy || deleteConfirmationText !== "DELETE"}
                    >
                      {deleteBusy ? (
                        <>
                          <LoaderIcon size={16} />
                          <span>Deleting Account...</span>
                        </>
                      ) : (
                        <span>Permanently Delete My Account</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ================= ABOUT TAB ================= */}
            {currentTab === "about" && (
              <div className="settings-section-card glass-panel">
                <div className="settings-card-header">
                  <h3>About ANOY</h3>
                  <p>The social platform designed for students across Bharat.</p>
                </div>

                <div className="about-branding-hero">
                  <div className="about-logo-badge">A</div>
                  <h4>ANOY</h4>
                  <div className="about-tagline">Apna Social Space</div>
                  <div className="about-version">Version 1.0.0 (Production Build)</div>
                  <div className="about-bharat-pill">🇮🇳 Made with pride for Indian Universities</div>
                </div>

                <div className="settings-divider" />

                <div className="about-legal-section">
                  <h4>Platform Policies & Legal Information</h4>
                  <p>
                    ANOY is built to foster safe, vibrant, and authentic campus communities. Read our full documentation:
                  </p>

                  <div className="about-legal-links-row" style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
                    <Link to="/privacy" className="settings-legal-button">
                      <ShieldIcon size={16} />
                      <span>Privacy Policy</span>
                    </Link>
                    <Link to="/terms" className="settings-legal-button">
                      <LockIcon size={16} />
                      <span>Terms of Service</span>
                    </Link>
                  </div>

                  <p className="legal-pilot-disclaimer" style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
                    ANOY is currently in pilot campus deployment. Institutional policy adaptation and formal compliance review are conducted in collaboration with university administrators.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel-glow" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Reset Password via Email OTP</h3>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => setShowForgotModal(false)}
              >
                ✕
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestForgotOtp} style={{ padding: "16px 0 0" }}>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
                  Enter your account email address. We will send a 6-digit verification code to reset your password.
                </p>
                <div className="settings-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="settings-action-row" style={{ marginTop: 20 }}>
                  <button
                    type="submit"
                    className="composer-submit-btn glow-button"
                    disabled={forgotBusy || !forgotEmail.trim()}
                  >
                    {forgotBusy ? <LoaderIcon size={16} /> : "Send Reset Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordWithOtp} style={{ padding: "16px 0 0" }}>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
                  A 6-digit verification code was sent to <strong>{forgotEmail}</strong>. Enter the code and your new password below.
                </p>
                <div className="settings-form-group">
                  <label>6-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    required
                    style={{ letterSpacing: 4, fontWeight: 700, textAlign: "center" }}
                  />
                </div>
                <div className="settings-form-group">
                  <label>New Password (min 8 characters)</label>
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    required
                  />
                </div>
                <div className="settings-action-row" style={{ marginTop: 20 }}>
                  <button
                    type="submit"
                    className="composer-submit-btn glow-button"
                    disabled={forgotBusy || !forgotOtp.trim() || !forgotNewPass}
                  >
                    {forgotBusy ? <LoaderIcon size={16} /> : "Reset Password & Login"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
