import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import AnoyLogo from "./AnoyLogo";
import {
  HomeIcon,
  CompassIcon,
  SearchIcon,
  BellIcon,
  MessageCircleIcon,
  UserIcon,
  UsersIcon,
  LogOutIcon,
  PlusIcon,
  SparklesIcon,
  SettingsIcon
} from "./Icons";
import NotificationBadge from "./NotificationBadge";

function Sidebar({ onOpenPostComposer }) {
  const { user, profile, logout, unreadCount } = useAuth();
  const { unreadMessagesCount } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const username = user?.username || "user";
  const displayName = profile?.displayName || username;
  const avatarLetter = (displayName || username).charAt(0).toUpperCase();

  return (
    <aside className="sidebar" aria-label="Main Sidebar Navigation">
      <div className="sidebar-top">
        {/* Brand Logo with ANOY + cursive "Apna Social Space" */}
        <div className="sidebar-brand-wrapper">
          <AnoyLogo
            variant="sidebar"
            showTagline={true}
            clickable={true}
          />
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Home Feed"
          >
            <HomeIcon size={21} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/explore"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Explore Feed"
          >
            <CompassIcon size={21} />
            <span>Explore</span>
          </NavLink>

          <NavLink
            to="/search"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Search"
          >
            <SearchIcon size={21} />
            <span>Search</span>
          </NavLink>

          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Messages"
          >
            <MessageCircleIcon size={21} />
            <span>Messages</span>
            <NotificationBadge count={unreadMessagesCount} />
          </NavLink>

          <NavLink
            to="/communities"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Communities"
          >
            <UsersIcon size={21} />
            <span>Communities</span>
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Notifications"
          >
            <BellIcon size={21} />
            <span>Notifications</span>
            <NotificationBadge count={unreadCount} />
          </NavLink>

          <NavLink
            to="/ai"
            className={({ isActive }) =>
              `nav-item nav-item-ai ${isActive ? "active" : ""}`
            }
            aria-label="ANOY AI Assistant"
          >
            <SparklesIcon size={21} style={{ color: "#38bdf8" }} />
            <span style={{ background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700 }}>ANOY AI</span>
          </NavLink>

          <NavLink
            to="/store"
            className={({ isActive }) =>
              `nav-item nav-item-pro ${isActive ? "active" : ""}`
            }
            aria-label="ANOY Pro Store"
          >
            <SparklesIcon size={21} className="text-accent" />
            <span style={{ background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700 }}>ANOY Pro</span>
          </NavLink>

          {profile?.privacy === "PRIVATE" && (
            <NavLink
              to="/follow-requests"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              aria-label="Follow Requests"
            >
              <UsersIcon size={21} />
              <span>Requests</span>
            </NavLink>
          )}

          <NavLink
            to={`/profile/${username}`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Your Profile"
          >
            <UserIcon size={21} />
            <span>Profile</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            aria-label="Settings"
          >
            <SettingsIcon size={21} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Post Quick Action */}
        <button
          className="sidebar-post-btn glow-button"
          onClick={() => {
            if (onOpenPostComposer) {
              onOpenPostComposer();
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
              const composer = document.getElementById("post-composer-input");
              if (composer) composer.focus();
            }
          }}
          aria-label="Create a new post"
        >
          <PlusIcon size={20} />
          <span>New Post</span>
        </button>
      </div>

      <div className="sidebar-bottom">
        {/* Built for Bharat Footer Badge */}
        <div className="sidebar-bharat-badge">
          <span className="bharat-flag">🇮🇳</span>
          <span className="bharat-text">Built for Bharat, By Students</span>
        </div>

        {/* Current User Pill & Logout */}
        {user && (
          <div className="sidebar-user glass-panel">
            <Link
              to={`/profile/${username}`}
              className="sidebar-user-info"
              aria-label={`View your profile (@${username})`}
            >
              <div className="composer-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={username}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  avatarLetter
                )}
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-handle">@{username}</span>
              </div>
            </Link>

            <button
              className="logout-icon-btn"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out of ANOY"
            >
              <LogOutIcon size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
