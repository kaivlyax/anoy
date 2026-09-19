import { Link } from "react-router-dom";
import { ShieldIcon, LockIcon } from "./Icons";

function AdminAccessDenied({ currentRole = "USER", username = "user" }) {
  return (
    <div className="admin-access-denied-wrapper">
      <div className="admin-access-denied-card glass-panel">
        <div className="access-denied-icon-glow">
          <ShieldIcon size={48} className="access-denied-shield-icon" />
          <LockIcon size={24} className="access-denied-lock-badge" />
        </div>

        <h1 className="access-denied-title">403 — Access Denied</h1>
        <h2 className="access-denied-subtitle">Platform Administrator Privileges Required</h2>

        <p className="access-denied-desc">
          You are signed in as <strong className="user-highlight">@{username}</strong> with role{" "}
          <span className="role-tag-denied">{currentRole}</span>. This administrative portal is strictly restricted to platform administrators.
        </p>

        <div className="access-denied-warning-note">
          <span>Administrative route access attempts are subject to platform security logging.</span>
        </div>

        <div className="access-denied-actions">
          <Link to="/" className="composer-submit-btn glow-button">
            Return to Feed
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminAccessDenied;
