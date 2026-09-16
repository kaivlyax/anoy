import {
  MicIcon,
  MicOffIcon,
  CameraIcon,
  CameraOffIcon,
  ScreenShareIcon,
  ScreenShareOffIcon,
  UsersIcon,
  LogOutIcon
} from "./Icons";

export default function RoomControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  onToggleParticipants,
  participantCount = 0,
  showParticipants = false
}) {
  return (
    <div className="room-controls-dock" role="toolbar" aria-label="Study Room Controls">
      {/* Mic Toggle */}
      <button
        type="button"
        className={`control-btn ${isMuted ? "btn-danger" : "btn-secondary"}`}
        onClick={onToggleMic}
        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
        <span className="control-label">{isMuted ? "Unmute" : "Mute"}</span>
      </button>

      {/* Camera Toggle */}
      <button
        type="button"
        className={`control-btn ${isVideoOff ? "btn-danger" : "btn-secondary"}`}
        onClick={onToggleCamera}
        title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
        aria-label={isVideoOff ? "Start Video" : "Stop Video"}
      >
        {isVideoOff ? <CameraOffIcon size={20} /> : <CameraIcon size={20} />}
        <span className="control-label">{isVideoOff ? "Start Video" : "Stop Video"}</span>
      </button>

      {/* Screen Share Toggle */}
      <button
        type="button"
        className={`control-btn ${isScreenSharing ? "btn-active-share" : "btn-secondary"}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? "Stop Sharing Screen" : "Share Your Screen"}
        aria-label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
      >
        {isScreenSharing ? <ScreenShareOffIcon size={20} /> : <ScreenShareIcon size={20} />}
        <span className="control-label">{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
      </button>

      {/* Participant List Toggle */}
      <button
        type="button"
        className={`control-btn ${showParticipants ? "btn-active" : "btn-secondary"}`}
        onClick={onToggleParticipants}
        title="View Participants"
        aria-label="Participants"
      >
        <UsersIcon size={20} />
        <span className="control-label">Participants ({participantCount})</span>
      </button>

      {/* Leave Room Button */}
      <button
        type="button"
        className="control-btn btn-leave"
        onClick={onLeave}
        title="Leave Study Room"
        aria-label="Leave Room"
      >
        <LogOutIcon size={20} />
        <span className="control-label">Leave</span>
      </button>
    </div>
  );
}
