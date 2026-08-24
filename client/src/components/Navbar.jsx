import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  HomeIcon,
  CompassIcon,
  SearchIcon,
  BellIcon,
  UserIcon,
  LogOutIcon
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
    <header className="mobile-navbar">
      <Link to="/" className="brand-logo" style={{ padding: 0 }} aria-label="ANOY Home">
        <div className="brand-logo-badge" style={{ width: 32, height: 32, fontSize: 16 }}>
          A
        </div>
        <span style={{ fontSize: 18 }}>ANOY</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
  const username = user?.username || "user";

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
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
        to="/search"
        className={({ isActive }) =>
          `mobile-nav-item ${isActive ? "active" : ""}`
        }
        aria-label="Search"
      >
        <SearchIcon size={22} />
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
