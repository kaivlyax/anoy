import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  BellIcon,
  TrashIcon,
  LoaderIcon,
  AlertCircleIcon,
  HeartIcon,
  MessageCircleIcon,
  UserPlusIcon,
  UserCheckIcon,
  UsersIcon,
  SparklesIcon
} from "../components/Icons";

function Notifications() {
  const { resetUnreadCount, decrementUnreadCount } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await notificationApi.getNotifications(1, 50);
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Failed to load notifications"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    try {
      setMarkingAll(true);
      const response = await notificationApi.markAllAsRead();
      if (response.data.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        );
        resetUnreadCount();
        addToast("All notifications marked as read", "success");
      }
    } catch {
      addToast("Failed to mark notifications read", "error");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      const response = await notificationApi.markAsRead(id);
      if (response.data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
        decrementUnreadCount(1);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (deletingId) return;
    try {
      setDeletingId(id);
      const response = await notificationApi.deleteNotification(id);
      if (response.data.success) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        addToast("Notification removed", "info");
      }
    } catch {
      addToast("Failed to delete notification", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkRead(notification._id);
    }

    if (notification.type === "FOLLOW" && notification.message.includes("follow request")) {
      navigate("/follow-requests");
    } else if (notification.sender?.username) {
      navigate(`/profile/${notification.sender.username}`);
    }
  };

  const getNotificationIcon = (type, message) => {
    switch (type) {
      case "LIKE":
        return <HeartIcon size={18} filled className="notif-icon-like" />;
      case "COMMENT":
        return <MessageCircleIcon size={18} className="notif-icon-comment" />;
      case "FOLLOW":
        if (message?.includes("request")) {
          return <UsersIcon size={18} className="notif-icon-request" />;
        }
        return <UserPlusIcon size={18} className="notif-icon-follow" />;
      case "FOLLOW_ACCEPTED":
        return <UserCheckIcon size={18} className="notif-icon-accepted" />;
      case "MESSAGE":
        return <SparklesIcon size={18} className="notif-icon-system" />;
      default:
        return <BellIcon size={18} className="notif-icon-system" />;
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="main-feed-column">
      {/* Sticky Header with Action & Filter Tabs */}
      <header className="sticky-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px 8px 20px"
          }}
        >
          <h2 className="sticky-header-title" style={{ padding: 0 }}>
            Notifications
          </h2>
          {unreadCount > 0 && (
            <button
              className="composer-submit-btn"
              style={{
                padding: "5px 12px",
                fontSize: 12,
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)"
              }}
              disabled={markingAll}
              onClick={handleMarkAllRead}
              aria-label="Mark all notifications as read"
            >
              {markingAll ? <LoaderIcon size={12} /> : "Mark all read"}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="feed-tabs">
          <button
            className={`feed-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
            aria-label="Show all notifications"
          >
            All
          </button>
          <button
            className={`feed-tab ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
            aria-label="Show unread notifications"
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </header>

      <main>
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="notification-item-card">
                <div
                  className="skeleton-box"
                  style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="skeleton-box" style={{ width: "70%", height: 14 }} />
                  <div className="skeleton-box" style={{ width: "25%", height: 11 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-feed">
            <div className="empty-feed-icon" style={{ color: "#ef4444" }}>
              <AlertCircleIcon size={30} />
            </div>
            <h3 className="empty-feed-title">Error</h3>
            <p className="empty-feed-subtitle">{error}</p>
            <button
              className="composer-submit-btn"
              style={{ marginTop: 8 }}
              onClick={fetchNotifications}
            >
              Try Again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-icon">
              <BellIcon size={30} />
            </div>
            <h3 className="empty-feed-title">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </h3>
            <p className="empty-feed-subtitle">
              When people follow you, like your posts, or reply to you, you'll find them here.
            </p>
          </div>
        ) : (
          <div>
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`notification-item-card ${
                  !notification.read ? "unread" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
                role="button"
                tabIndex={0}
                aria-label={`Notification: ${notification.message}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNotificationClick(notification);
                }}
              >
                {/* Notification Icon */}
                <div className="notification-type-badge">
                  {getNotificationIcon(
                    notification.type,
                    notification.message
                  )}
                </div>

                {/* Notification Body */}
                <div className="notification-item-main">
                  <div className="notification-item-header">
                    <p className="notification-message-text">
                      {notification.sender?.username && (
                        <Link
                          to={`/profile/${notification.sender.username}`}
                          className="notification-sender-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{notification.sender.username}
                        </Link>
                      )}{" "}
                      {notification.message}
                    </p>

                    <button
                      type="button"
                      className="post-delete-btn"
                      disabled={deletingId === notification._id}
                      onClick={(e) => handleDelete(e, notification._id)}
                      title="Delete notification"
                      aria-label="Delete this notification"
                    >
                      {deletingId === notification._id ? (
                        <LoaderIcon size={12} />
                      ) : (
                        <TrashIcon size={14} />
                      )}
                    </button>
                  </div>

                  <span className="notification-item-time">
                    {new Date(notification.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Notifications;