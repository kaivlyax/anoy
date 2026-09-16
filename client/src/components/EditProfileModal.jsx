import { useState, useEffect, useRef } from "react";
import { profileApi, mediaApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  XIcon,
  LoaderIcon,
  LockIcon,
  GlobeIcon,
  ImageIcon,
  CameraIcon
} from "./Icons";

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

  // Uploading state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

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

  // Handle Avatar file upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast("Avatar image must be under 5MB", "error");
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("image", file);

      const res = await mediaApi.uploadImage(formData);
      if (res.data.success && res.data.media?.url) {
        setAvatar(res.data.media.url);
        addToast("Avatar uploaded successfully!", "success");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      addToast(err.response?.data?.message || "Failed to upload avatar", "error");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Handle Cover file upload
  const handleCoverFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast("Cover image must be under 5MB", "error");
      return;
    }

    try {
      setUploadingCover(true);
      const formData = new FormData();
      formData.append("image", file);

      const res = await mediaApi.uploadImage(formData);
      if (res.data.success && res.data.media?.url) {
        setCoverImage(res.data.media.url);
        addToast("Cover banner uploaded successfully!", "success");
      }
    } catch (err) {
      console.error("Cover upload error:", err);
      addToast(err.response?.data?.message || "Failed to upload cover banner", "error");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

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
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={avatarInputRef}
          onChange={handleAvatarFileChange}
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
        />
        <input
          type="file"
          ref={coverInputRef}
          onChange={handleCoverFileChange}
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
        />

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
          {/* Cover & Avatar Preview Section */}
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

            <button
              type="button"
              className="btn-banner-upload-overlay"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              title="Upload Cover Banner"
            >
              {uploadingCover ? <LoaderIcon size={16} /> : <ImageIcon size={16} />}
              <span>{uploadingCover ? "Uploading..." : "Change Cover"}</span>
            </button>

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

              <button
                type="button"
                className="btn-avatar-upload-overlay"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Upload Avatar Image"
              >
                {uploadingAvatar ? <LoaderIcon size={14} /> : <CameraIcon size={14} />}
              </button>
            </div>
          </div>

          {/* Upload Action Buttons */}
          <div className="profile-upload-action-row" style={{ marginTop: 42 }}>
            <div className="upload-control-col">
              <label className="upload-section-label">Avatar Picture</label>
              <div className="upload-btn-group">
                <button
                  type="button"
                  className="btn-upload-trigger"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? <LoaderIcon size={15} /> : <CameraIcon size={15} />}
                  <span>{uploadingAvatar ? "Uploading Avatar..." : "Upload Avatar"}</span>
                </button>
                {avatar && (
                  <button
                    type="button"
                    className="btn-remove-trigger"
                    onClick={() => setAvatar("")}
                    disabled={uploadingAvatar}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="upload-control-col">
              <label className="upload-section-label">Cover Banner</label>
              <div className="upload-btn-group">
                <button
                  type="button"
                  className="btn-upload-trigger"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? <LoaderIcon size={15} /> : <ImageIcon size={15} />}
                  <span>{uploadingCover ? "Uploading Banner..." : "Upload Cover"}</span>
                </button>
                {coverImage && (
                  <button
                    type="button"
                    className="btn-remove-trigger"
                    onClick={() => setCoverImage("")}
                    disabled={uploadingCover}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
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
