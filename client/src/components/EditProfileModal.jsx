import { useState, useEffect } from "react";
import { profileApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { XIcon, LoaderIcon, LockIcon, GlobeIcon, ImageIcon } from "./Icons";

function EditProfileModal({ isOpen, onClose, onProfileUpdated }) {
  const { profile, setProfile } = useAuth();
  const { addToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatar, setAvatar] = useState(profile?.avatar || "");
  const [coverImage, setCoverImage] = useState(profile?.coverImage || "");
  const [skills, setSkills] = useState(profile?.skills?.join(", ") || "");
  const [interests, setInterests] = useState(profile?.interests?.join(", ") || "");
  const [privacy, setPrivacy] = useState(profile?.privacy || "PUBLIC");
  const [saving, setSaving] = useState(false);

  // Sync state if profile changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setAvatar(profile.avatar || "");
      setCoverImage(profile.coverImage || "");
      setSkills(profile.skills?.join(", ") || "");
      setInterests(profile.interests?.join(", ") || "");
      setPrivacy(profile.privacy || "PUBLIC");
    }
  }, [profile]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);

      const parsedSkills = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedInterests = interests
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);

      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        coverImage: coverImage.trim(),
        skills: parsedSkills,
        interests: parsedInterests,
        privacy
      };

      const response = await profileApi.updateMyProfile(payload);

      if (response.data.success && response.data.profile) {
        setProfile(response.data.profile);
        if (onProfileUpdated) {
          onProfileUpdated(response.data.profile);
        }
        addToast("Profile updated successfully!", "success");
        onClose();
      }
    } catch (err) {
      console.error(err);
      addToast(
        err.response?.data?.message || "Failed to update profile",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={saving ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-modal-title"
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2 id="edit-profile-modal-title" className="modal-title">
            Edit Profile
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit profile modal"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Cover & Avatar Preview */}
          <div className="profile-banner-edit-preview">
            {coverImage ? (
              <img
                src={coverImage}
                alt="Cover Preview"
                className="edit-cover-img"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="edit-cover-placeholder">
                <ImageIcon size={28} />
                <span>No Cover Image</span>
              </div>
            )}

            <div className="edit-avatar-container">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar Preview"
                  className="edit-avatar-img"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div className="edit-avatar-placeholder">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 40 }}>
            <label htmlFor="edit-displayName">Display Name</label>
            <input
              id="edit-displayName"
              type="text"
              placeholder="e.g. Alex Sharma"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-bio">Bio</label>
            <textarea
              id="edit-bio"
              className="composer-textarea"
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                background: "var(--bg-app)",
                fontSize: 14,
                minHeight: 80
              }}
              placeholder="Tell the community about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-avatar">Avatar Image URL</label>
            <input
              id="edit-avatar"
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-cover">Cover Banner URL</label>
            <input
              id="edit-cover"
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-skills">Skills (comma-separated)</label>
            <input
              id="edit-skills"
              type="text"
              placeholder="React, Node.js, TypeScript, UI/UX"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-interests">Interests (comma-separated)</label>
            <input
              id="edit-interests"
              type="text"
              placeholder="AI, Web3, OpenSource, Startups"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-privacy">Account Privacy</label>
            <div className="privacy-toggle-group">
              <label
                className={`privacy-toggle-option ${
                  privacy === "PUBLIC" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="privacy"
                  value="PUBLIC"
                  checked={privacy === "PUBLIC"}
                  onChange={() => setPrivacy("PUBLIC")}
                />
                <GlobeIcon size={16} />
                <div>
                  <strong>Public</strong>
                  <p>Anyone can view your profile and follow you instantly</p>
                </div>
              </label>

              <label
                className={`privacy-toggle-option ${
                  privacy === "PRIVATE" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="privacy"
                  value="PRIVATE"
                  checked={privacy === "PRIVATE"}
                  onChange={() => setPrivacy("PRIVATE")}
                />
                <LockIcon size={16} />
                <div>
                  <strong>Private</strong>
                  <p>Require approval for new followers; profile hidden to non-followers</p>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="composer-submit-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderIcon size={16} />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
