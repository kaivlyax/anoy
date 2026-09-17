import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import AnoyLogo from "./AnoyLogo";
import {
  HomeIcon,
  CompassIcon,
  MessageCircleIcon,
  BellIcon,
  UserIcon,
  LogOutIcon,
  UsersIcon,
  SparklesIcon,
  SettingsIcon
} from "./Icons";
import NotificationBadge from "./NotificationBadge";

export function MobileNavbar() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const username = user?.username || "user";
  const displayName = profile?.displayName || username;

  return (
    <header className="mobile-navbar glass-panel">
      <Link to="/" className="mobile-brand-link" aria-label="ANOY Home">
        <AnoyLogo
          variant="navbar"
          showTagline={true}
          clickable={false}
        />
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          to="/ai"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2))",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            color: "#38bdf8"
          }}
          aria-label="Open ANOY AI"
          title="ANOY AI Assistant"
        >
          <SparklesIcon size={16} />
        </Link>

        <Link
          to={`/profile/${username}`}
          style={{ display: "flex", alignItems: "center" }}
          aria-label="View your profile"
        >
          <div
            className="composer-avatar"
            style={{ width: 32, height: 32, fontSize: 14 }}
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={username}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              (displayName || username).charAt(0).toUpperCase()
            )}
          </div>
        </Link>

        <Link
          to="/settings"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            padding: 4
          }}
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </Link>

        <button
          className="logout-icon-btn"
          onClick={handleLogout}
          aria-label="Log out"
        >
          <LogOutIcon size={18} />
        </button>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { user, unreadCount } = useAuth();
  const { unreadMessagesCount } = useSocket();
  const username = user?.username || "user";

  return (
    <nav className="mobile-bottom-nav glass-panel" aria-label="Mobile Bottom Navigation">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Home Feed"
      >
        <HomeIcon size={22} />
      </NavLink>

      <NavLink
        to="/explore"
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Explore Feed"
      >
        <CompassIcon size={22} />
      </NavLink>

      <NavLink
        to="/messages"
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Messages"
      >
        <MessageCircleIcon size={22} />
        <NotificationBadge
          count={unreadMessagesCount}
          style={{ position: "absolute", top: 4, right: 8 }}
        />
      </NavLink>

      <NavLink
        to="/communities"
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Communities"
      >
        <UsersIcon size={22} />
      </NavLink>

      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Notifications"
      >
        <BellIcon size={22} />
        <NotificationBadge
          count={unreadCount}
          style={{ position: "absolute", top: 4, right: 8 }}
        />
      </NavLink>

      <NavLink
        to={`/profile/${username}`}
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Profile"
      >
        <UserIcon size={22} />
      </NavLink>
    </nav>
  );
}

export default MobileNavbar;
