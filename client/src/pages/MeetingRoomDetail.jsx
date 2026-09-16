import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { meetingRoomApi } from "../services/api";
import { WebRTCManager } from "../services/webrtc";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import VideoTile from "../components/VideoTile";
import ScreenShareView from "../components/ScreenShareView";
import RoomControls from "../components/RoomControls";
import AvatarFrame from "../components/AvatarFrame";
import ProBadge from "../components/ProBadge";
import {
  GraduationCapIcon,
  LoaderIcon,
  AlertCircleIcon,
  MicOffIcon,
  CameraOffIcon,
  XIcon,
  UsersIcon,
  LockIcon
} from "../components/Icons";

export default function MeetingRoomDetail() {
  const { slug, roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  // Media States
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);

  // Remote Peers: socketId -> { user, stream, isMuted, isVideoOff, isScreenSharing }
  const [remotePeers, setRemotePeers] = useState(new Map());

  // UI state
  const [showParticipants, setShowParticipants] = useState(false);

  const webrtcManagerRef = useRef(null);

  // Fetch room metadata
  const fetchRoomData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await meetingRoomApi.getRoom(roomId);
      if (res.data.success) {
        setRoom(res.data.meetingRoom || res.data.room);
      }
    } catch (err) {
      console.error("Fetch meeting room error:", err);
      addToast(err.response?.data?.message || "Meeting room not found or unauthorized", "error");
      navigate(slug ? `/communities/${slug}` : "/communities");
    } finally {
      setLoading(false);
    }
  }, [roomId, slug, navigate, addToast]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // Handle remote stream incoming from WebRTC manager
  const handleRemoteStream = useCallback((remoteSocketId, stream) => {
    setRemotePeers((prev) => {
      const next = new Map(prev);
      const existing = next.get(remoteSocketId) || {};
      next.set(remoteSocketId, {
        ...existing,
        socketId: remoteSocketId,
        stream
      });
      return next;
    });
  }, []);

  // Handle peer disconnected
  const handlePeerLeft = useCallback((remoteSocketId) => {
    setRemotePeers((prev) => {
      const next = new Map(prev);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  // Initialize WebRTC & Media streams
  useEffect(() => {
    if (!socket || !isConnected || !roomId) return;

    const manager = new WebRTCManager(socket, handleRemoteStream, handlePeerLeft);
    webrtcManagerRef.current = manager;

    // Start local audio & video
    manager
      .startLocalStream(true, true)
      .then((stream) => {
        setLocalStream(stream);
        setPermissionError("");
      })
      .catch((err) => {
        console.warn("Media devices error:", err);
        setPermissionError(
          "Camera/Microphone access was blocked. You can still participate in voice/presentation mode."
        );
      });

    // Join room via Socket.IO
    socket.emit(
      "join_meeting_room",
      {
        roomId,
        passcode: location.state?.passcode || ""
      },
      (res) => {
        if (!res?.success) {
          addToast(res?.message || "Failed to join meeting room", "error");
          navigate(slug ? `/communities/${slug}` : "/communities");
          return;
        }

        // Initialize peer connections for all existing participants in the room
        if (Array.isArray(res.peers)) {
          res.peers.forEach((peer) => {
            setRemotePeers((prev) => {
              const next = new Map(prev);
              next.set(peer.socketId, {
                socketId: peer.socketId,
                user: peer.user,
                stream: null,
                isMuted: false,
                isVideoOff: false,
                isScreenSharing: false
              });
              return next;
            });

            // As the joining user, initiate connection to existing peers
            manager.createPeerConnection(peer.socketId, true);
          });
        }
      }
    );

    // Socket Event: New user joined
    const handleUserJoined = ({ socketId, user: joinedUser }) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.set(socketId, {
          socketId,
          user: joinedUser,
          stream: null,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false
        });
        return next;
      });

      // Answer side connection
      manager.createPeerConnection(socketId, false);
      addToast(`${joinedUser?.displayName || joinedUser?.username || "A student"} joined`, "info");
    };

    // Socket Event: User left
    const handleUserLeft = ({ socketId }) => {
      manager.removePeer(socketId);
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    // Socket Event: WebRTC signal
    const handleSignal = ({ fromSocketId, signalData, type }) => {
      manager.handleSignal(fromSocketId, signalData, type);
    };

    // Socket Event: Remote state change (Mute / Cam / Screen share)
    const handleStateChange = ({ socketId, isMuted: peerMuted, isVideoOff: peerVideoOff, isScreenSharing: peerSharing }) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(socketId);
        if (peer) {
          next.set(socketId, {
            ...peer,
            isMuted: typeof peerMuted === "boolean" ? peerMuted : peer.isMuted,
            isVideoOff: typeof peerVideoOff === "boolean" ? peerVideoOff : peer.isVideoOff,
            isScreenSharing: typeof peerSharing === "boolean" ? peerSharing : peer.isScreenSharing
          });
        }
        return next;
      });
    };

    socket.on("meeting_room:user_joined", handleUserJoined);
    socket.on("meeting_room:user_left", handleUserLeft);
    socket.on("meeting_room:signal", handleSignal);
    socket.on("meeting_room:participant_state_changed", handleStateChange);

    // Also support study room alias events for backwards compatibility
    socket.on("study_room:user_joined", handleUserJoined);
    socket.on("study_room:user_left", handleUserLeft);
    socket.on("study_room:signal", handleSignal);
    socket.on("study_room:participant_state_changed", handleStateChange);

    return () => {
      socket.emit("leave_meeting_room", { roomId });
      socket.off("meeting_room:user_joined", handleUserJoined);
      socket.off("meeting_room:user_left", handleUserLeft);
      socket.off("meeting_room:signal", handleSignal);
      socket.off("meeting_room:participant_state_changed", handleStateChange);

      socket.off("study_room:user_joined", handleUserJoined);
      socket.off("study_room:user_left", handleUserLeft);
      socket.off("study_room:signal", handleSignal);
      socket.off("study_room:participant_state_changed", handleStateChange);

      manager.cleanupAll();
    };
  }, [socket, isConnected, roomId, location.state, navigate, slug, addToast, handleRemoteStream, handlePeerLeft]);

  // Controls: Mute toggle
  const handleToggleMic = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    webrtcManagerRef.current?.setAudioEnabled(!nextState);

    if (socket && isConnected) {
      socket.emit("meeting_room:state_change", {
        roomId,
        isMuted: nextState
      });
    }
  };

  // Controls: Camera toggle
  const handleToggleCamera = () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);
    webrtcManagerRef.current?.setVideoEnabled(!nextState);

    if (socket && isConnected) {
      socket.emit("meeting_room:state_change", {
        roomId,
        isVideoOff: nextState
      });
    }
  };

  // Controls: Screen share toggle
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      await webrtcManagerRef.current?.stopScreenShare();
      setIsScreenSharing(false);
      setLocalScreenStream(null);

      if (socket && isConnected) {
        socket.emit("meeting_room:state_change", {
          roomId,
          isScreenSharing: false
        });
      }
    } else {
      try {
        const stream = await webrtcManagerRef.current?.startScreenShare(() => {
          setIsScreenSharing(false);
          setLocalScreenStream(null);
          if (socket && isConnected) {
            socket.emit("meeting_room:state_change", {
              roomId,
              isScreenSharing: false
            });
          }
        });

        setIsScreenSharing(true);
        setLocalScreenStream(stream);

        if (socket && isConnected) {
          socket.emit("meeting_room:state_change", {
            roomId,
            isScreenSharing: true
          });
        }
      } catch {
        addToast("Screen sharing was cancelled or unavailable.", "info");
      }
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    webrtcManagerRef.current?.cleanupAll();
    if (socket && isConnected) {
      socket.emit("leave_meeting_room", { roomId });
    }
    navigate(slug ? `/communities/${slug}` : "/communities");
  };

  if (loading || !room) {
    return (
      <div className="study-room-loading">
        <LoaderIcon size={40} />
        <span>Joining meeting room...</span>
      </div>
    );
  }

  // Find active screen sharer (either local or remote peer)
  const remoteScreenSharer = Array.from(remotePeers.values()).find((p) => p.isScreenSharing);
  const isAnyScreenSharing = isScreenSharing || Boolean(remoteScreenSharer);

  const activeScreenStream = isScreenSharing
    ? localScreenStream
    : remoteScreenSharer?.stream;

  const activeScreenPresenterName = isScreenSharing
    ? "You"
    : remoteScreenSharer?.user?.displayName || remoteScreenSharer?.user?.username;

  const totalParticipantsCount = 1 + remotePeers.size;

  const localUserObj = {
    _id: user?.id || user?._id,
    username: user?.username,
    displayName: profile?.displayName || user?.username,
    avatar: profile?.avatar,
    avatarDecoration: profile?.avatarDecoration,
    isPro: profile?.isPro
  };

  const communitySlug = room.community?.slug || slug;

  return (
    <div className="study-room-conference-view">
      {/* Top Navigation / Status Header */}
      <header className="conference-header">
        <div className="conference-info">
          <Link
            to={`/communities/${communitySlug}`}
            className="conference-back-btn"
            title="Back to Community"
          >
            ←
          </Link>
          <div>
            <div className="conference-title-row">
              <GraduationCapIcon size={20} className="study-header-icon" />
              <h2 className="conference-title">{room.name || room.title}</h2>
              {room.community && (
                <span className="conference-topic-pill">
                  {room.community.name}
                </span>
              )}
              {room.isPrivate && (
                <span className="comm-room-locked-pill">
                  <LockIcon size={12} /> Private
                </span>
              )}
            </div>
            <span className="conference-subtext">
              {room.description || `Meeting Room in ${room.community?.name || "Community"}`}
            </span>
          </div>
        </div>

        <div className="conference-header-right">
          <div className="live-status-pill">
            <span className="live-pulse-dot" />
            <span>LIVE ({totalParticipantsCount} / {room.maxParticipants || 10})</span>
          </div>
        </div>
      </header>

      {/* Permission warning banner if blocked */}
      {permissionError && (
        <div className="media-permission-banner">
          <AlertCircleIcon size={18} />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Conference Stage */}
      <main className={`conference-stage ${isAnyScreenSharing ? "presentation-mode" : ""}`}>
        {/* Prominent Screen Sharing Presentation */}
        {isAnyScreenSharing && (
          <div className="conference-presentation-area">
            <ScreenShareView
              stream={activeScreenStream}
              presenterName={activeScreenPresenterName}
              isLocal={isScreenSharing}
            />
          </div>
        )}

        {/* Video Tiles Grid */}
        <div
          className={`conference-video-grid ${
            isAnyScreenSharing ? "grid-strip" : `grid-count-${Math.min(totalParticipantsCount, 8)}`
          }`}
        >
          {/* Local User Tile */}
          <VideoTile
            stream={localStream}
            user={localUserObj}
            isLocal={true}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
          />

          {/* Remote Peer Video Tiles */}
          {Array.from(remotePeers.values()).map((peer) => (
            <VideoTile
              key={peer.socketId}
              stream={peer.stream}
              user={peer.user}
              isLocal={false}
              isMuted={peer.isMuted}
              isVideoOff={peer.isVideoOff}
              isScreenSharing={peer.isScreenSharing}
            />
          ))}
        </div>

        {/* Participants Drawer (Toggleable) */}
        {showParticipants && (
          <aside className="conference-participants-drawer">
            <div className="drawer-header">
              <h3>
                <UsersIcon size={16} /> Participants ({totalParticipantsCount})
              </h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowParticipants(false)}
                aria-label="Close drawer"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="drawer-participants-list">
              {/* Local User Item */}
              <div className="drawer-user-row">
                <AvatarFrame decoration={profile?.avatarDecoration} size="sm">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="You" className="drawer-avatar-img" />
                  ) : (
                    <div className="drawer-avatar-placeholder">
                      {(profile?.displayName || user?.username || "Y").charAt(0).toUpperCase()}
                    </div>
                  )}
                </AvatarFrame>
                <div className="drawer-user-info">
                  <span className="drawer-user-name">{profile?.displayName || user?.username} (You)</span>
                  {profile?.isPro && <ProBadge size="sm" />}
                </div>
                <div className="drawer-user-icons">
                  {isMuted && <MicOffIcon size={15} className="text-danger" />}
                  {isVideoOff && <CameraOffIcon size={15} className="text-dim" />}
                </div>
              </div>

              {/* Remote Participants */}
              {Array.from(remotePeers.values()).map((peer) => (
                <div key={peer.socketId} className="drawer-user-row">
                  <AvatarFrame decoration={peer.user?.avatarDecoration} size="sm">
                    {peer.user?.avatar ? (
                      <img src={peer.user.avatar} alt={peer.user.displayName} className="drawer-avatar-img" />
                    ) : (
                      <div className="drawer-avatar-placeholder">
                        {(peer.user?.displayName || peer.user?.username || "S").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </AvatarFrame>
                  <div className="drawer-user-info">
                    <span className="drawer-user-name">{peer.user?.displayName || peer.user?.username}</span>
                    {peer.user?.isPro && <ProBadge size="sm" />}
                  </div>
                  <div className="drawer-user-icons">
                    {peer.isMuted && <MicOffIcon size={15} className="text-danger" />}
                    {peer.isVideoOff && <CameraOffIcon size={15} className="text-dim" />}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </main>

      {/* Fixed Bottom Controls Dock */}
      <footer className="conference-footer">
        <RoomControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onLeave={handleLeaveRoom}
          onToggleParticipants={() => setShowParticipants((prev) => !prev)}
          participantCount={totalParticipantsCount}
          showParticipants={showParticipants}
        />
      </footer>
    </div>
  );
}
