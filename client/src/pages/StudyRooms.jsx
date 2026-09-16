import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { studyRoomApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import {
  GraduationCapIcon,
  SearchIcon,
  PlusIcon,
  UsersIcon,
  LockIcon,
  LoaderIcon,
  XIcon,
  CameraIcon
} from "../components/Icons";

const TOPICS = [
  "All",
  "Computer Science",
  "Mathematics",
  "Engineering",
  "Design & UI/UX",
  "Physics & Sciences",
  "General Study"
];

export default function StudyRooms() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Room Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("Computer Science");
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [creating, setCreating] = useState(false);

  // Passcode prompt for private rooms
  const [promptRoom, setPromptRoom] = useState(null);
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joining, setJoining] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await studyRoomApi.getRooms({
        topic: selectedTopic !== "All" ? selectedTopic : undefined,
        q: searchQuery || undefined
      });
      if (res.data.success) {
        setRooms(res.data.rooms || []);
      }
    } catch (err) {
      console.error("Fetch study rooms error:", err);
      addToast("Failed to load study rooms.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, searchQuery, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRooms();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchRooms]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreating(true);
      const res = await studyRoomApi.createRoom({
        title,
        description,
        topic,
        isPrivate,
        passcode,
        maxParticipants
      });

      if (res.data.success) {
        addToast(`Created room "${res.data.room.title}"!`, "success");
        setShowCreateModal(false);
        navigate(`/study-rooms/${res.data.room._id}`);
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to create study room", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClick = (room) => {
    if (room.hasPasscode) {
      setPromptRoom(room);
      setEnteredPasscode("");
    } else {
      navigate(`/study-rooms/${room._id}`);
    }
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (!promptRoom) return;

    try {
      setJoining(true);
      const res = await studyRoomApi.joinRoom(promptRoom._id, enteredPasscode);
      if (res.data.success) {
        setPromptRoom(null);
        navigate(`/study-rooms/${promptRoom._id}`, { state: { passcode: enteredPasscode } });
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Incorrect passcode", "error");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="study-rooms-page">
      {/* Top Header */}
      <div className="study-rooms-header">
        <div className="study-header-text">
          <div className="study-title-row">
            <GraduationCapIcon size={28} className="study-header-icon" />
            <h1 className="page-title">Study Rooms</h1>
          </div>
          <p className="page-subtitle">
            Collaborative group study spaces with WebRTC voice, video, and live screen sharing.
          </p>
        </div>

        <button
          type="button"
          className="create-study-room-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon size={18} />
          <span>Create Study Room</span>
        </button>
      </div>

      {/* Search & Topic Filters */}
      <div className="study-filters-row">
        <div className="search-bar-wrapper study-search">
          <SearchIcon size={18} className="search-icon-svg" />
          <input
            type="text"
            placeholder="Search study rooms by topic or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="study-topic-pills">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              className={`topic-pill ${selectedTopic === t ? "active" : ""}`}
              onClick={() => setSelectedTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Study Rooms Grid */}
      <div className="study-rooms-grid">
        {loading ? (
          <div className="study-loading-state">
            <LoaderIcon size={36} />
            <span>Loading active study rooms...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="study-empty-state">
            <CameraIcon size={48} />
            <h3>No Active Study Rooms</h3>
            <p>Be the first student to create a collaboration room for your class or project!</p>
            <button
              type="button"
              className="btn-create-first-room"
              onClick={() => setShowCreateModal(true)}
            >
              <PlusIcon size={16} />
              <span>Create a Room</span>
            </button>
          </div>
        ) : (
          rooms.map((room) => {
            const count = room.activeParticipants?.length || 0;
            const isFull = count >= (room.maxParticipants || 8);

            return (
              <div key={room._id} className="study-room-card">
                <div className="room-card-top">
                  <span className="room-topic-badge">{room.topic || "General"}</span>
                  {room.hasPasscode && (
                    <span className="room-private-pill" title="Private Passcode Protected">
                      <LockIcon size={13} /> Private
                    </span>
                  )}
                </div>

                <h3 className="room-card-title">{room.title}</h3>
                <p className="room-card-desc">{room.description || "Join this room to study and collaborate."}</p>

                {/* Creator & Participants */}
                <div className="room-card-footer">
                  <div className="room-participants-preview">
                    <UsersIcon size={16} />
                    <span className="participant-count-text">
                      {count} / {room.maxParticipants} students
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`btn-join-room ${isFull ? "btn-disabled" : ""}`}
                    onClick={() => handleJoinClick(room)}
                    disabled={isFull}
                  >
                    {isFull ? "Room Full" : "Join Room →"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card study-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create a Study Room</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="modal-form">
              <div className="form-group">
                <label>Room Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Systems Exam Prep"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label>Topic / Subject</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                  {TOPICS.filter((t) => t !== "All").map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="What is this study session focused on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Max Students (2 - 20)</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 8)}
                  />
                </div>

                <div className="form-group checkbox-group" style={{ marginTop: 24 }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    <span>Require Passcode</span>
                  </label>
                </div>
              </div>

              {isPrivate && (
                <div className="form-group">
                  <label>Room Passcode *</label>
                  <input
                    type="password"
                    placeholder="Enter room passcode..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required={isPrivate}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={creating || !title.trim()}>
                  {creating ? <LoaderIcon size={16} /> : "Launch Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Private Room Passcode Modal */}
      {promptRoom && (
        <div className="modal-backdrop" onClick={() => setPromptRoom(null)}>
          <div className="modal-card passcode-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Private Study Room</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPromptRoom(null)}
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            <p className="passcode-modal-desc">
              <strong>{promptRoom.title}</strong> is protected. Please enter the passcode to join.
            </p>

            <form onSubmit={handlePasscodeSubmit} className="modal-form">
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Enter passcode..."
                  value={enteredPasscode}
                  onChange={(e) => setEnteredPasscode(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setPromptRoom(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={joining || !enteredPasscode}>
                  {joining ? <LoaderIcon size={16} /> : "Join Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
