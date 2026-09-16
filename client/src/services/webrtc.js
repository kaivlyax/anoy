/**
 * WebRTC Peer Connection & Collaboration Manager for Study Rooms
 */

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ]
};

export class WebRTCManager {
  constructor(socket, onRemoteStream, onPeerLeft) {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onPeerLeft = onPeerLeft;

    this.localStream = null;
    this.screenStream = null;
    this.peers = new Map(); // socketId -> RTCPeerConnection
    this.pendingCandidates = new Map(); // socketId -> Array of RTCIceCandidateInit
  }

  /**
   * Acquire local camera and microphone stream
   */
  async startLocalStream(audio = true, video = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        }
      });

      // Apply initial mute/video off states
      this.setAudioEnabled(audio);
      this.setVideoEnabled(video);

      return this.localStream;
    } catch (err) {
      console.warn("Could not access camera/mic with full constraints, attempting audio only:", err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        return this.localStream;
      } catch (audioErr) {
        console.error("Microphone access denied:", audioErr);
        throw audioErr;
      }
    }
  }

  setAudioEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  setVideoEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Start screen sharing using browser getDisplayMedia
   */
  async startScreenShare(onEndedCallback) {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];

      screenTrack.onended = () => {
        this.stopScreenShare();
        if (onEndedCallback) onEndedCallback();
      };

      // Replace track in all peer connections
      await this.replaceVideoTrack(screenTrack);

      return this.screenStream;
    } catch (err) {
      console.error("Screen sharing error or cancelled:", err);
      throw err;
    }
  }

  /**
   * Stop screen sharing and revert back to camera stream if available
   */
  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    const cameraTrack = this.localStream?.getVideoTracks()[0] || null;
    await this.replaceVideoTrack(cameraTrack);
  }

  async replaceVideoTrack(newTrack) {
    for (const [, pc] of this.peers.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(newTrack);
      } else if (newTrack && pc.signalingState !== "closed") {
        pc.addTrack(newTrack, this.localStream || this.screenStream);
      }
    }
  }

  /**
   * Initialize a new RTCPeerConnection for a remote participant
   */
  createPeerConnection(remoteSocketId, isInitiator = false) {
    if (this.peers.has(remoteSocketId)) {
      return this.peers.get(remoteSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(remoteSocketId, pc);

    // Attach local stream tracks to this peer
    const activeStream = this.screenStream || this.localStream;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        pc.addTrack(track, activeStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit("study_room:signal", {
          toSocketId: remoteSocketId,
          signalData: event.candidate,
          type: "candidate"
        });
      }
    };

    // Remote track arrived
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (this.onRemoteStream) {
          this.onRemoteStream(remoteSocketId, event.streams[0]);
        }
      }
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.removePeer(remoteSocketId);
      }
    };

    // If initiator, generate SDP offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit("study_room:signal", {
            toSocketId: remoteSocketId,
            signalData: offer,
            type: "offer"
          });
        } catch (err) {
          console.error("Negotiation offer error:", err);
        }
      };
    }

    return pc;
  }

  /**
   * Process incoming WebRTC signaling message
   */
  async handleSignal(fromSocketId, signalData, type) {
    let pc = this.peers.get(fromSocketId);

    if (type === "offer") {
      if (!pc) {
        pc = this.createPeerConnection(fromSocketId, false);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signalData));

      // Process any queued candidates
      if (this.pendingCandidates.has(fromSocketId)) {
        const queued = this.pendingCandidates.get(fromSocketId);
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        }
        this.pendingCandidates.delete(fromSocketId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit("study_room:signal", {
        toSocketId: fromSocketId,
        signalData: answer,
        type: "answer"
      });
    } else if (type === "answer") {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));

        if (this.pendingCandidates.has(fromSocketId)) {
          const queued = this.pendingCandidates.get(fromSocketId);
          for (const candidate of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
          }
          this.pendingCandidates.delete(fromSocketId);
        }
      }
    } else if (type === "candidate") {
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData)).catch(console.warn);
      } else {
        if (!this.pendingCandidates.has(fromSocketId)) {
          this.pendingCandidates.set(fromSocketId, []);
        }
        this.pendingCandidates.get(fromSocketId).push(signalData);
      }
    }
  }

  removePeer(socketId) {
    const pc = this.peers.get(socketId);
    if (pc) {
      pc.close();
      this.peers.delete(socketId);
    }
    this.pendingCandidates.delete(socketId);
    if (this.onPeerLeft) {
      this.onPeerLeft(socketId);
    }
  }

  cleanupAll() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    for (const [, pc] of this.peers.entries()) {
      pc.close();
    }
    this.peers.clear();
    this.pendingCandidates.clear();
  }
}
