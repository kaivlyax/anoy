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
  constructor(socket, onRemoteStream, onPeerLeft, signalEvent = "meeting_room:signal") {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onPeerLeft = onPeerLeft;
    this.signalEvent = signalEvent;

    this.localStream = null;
    this.screenStream = null;
    this.peers = new Map(); // socketId -> RTCPeerConnection
    this.remoteStreams = new Map(); // socketId -> MediaStream
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

      // Attach tracks to all existing peer connections if any were created earlier
      this.attachLocalTracksToPeers();

      return this.localStream;
    } catch (err) {
      console.warn("Could not access camera/mic with full constraints, attempting audio only:", err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.setAudioEnabled(audio);
        this.attachLocalTracksToPeers();
        return this.localStream;
      } catch (audioErr) {
        console.error("Microphone access denied:", audioErr);
        throw audioErr;
      }
    }
  }

  attachLocalTracksToPeers() {
    const activeStream = this.screenStream || this.localStream;
    if (!activeStream) return;

    for (const [, pc] of this.peers.entries()) {
      if (pc.signalingState === "closed") continue;
      const senders = pc.getSenders();
      activeStream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
        if (!alreadyAdded) {
          try {
            pc.addTrack(track, activeStream);
          } catch (e) {
            console.warn("[WebRTC] Error attaching local track:", e);
          }
        }
      });
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
      if (pc.signalingState === "closed") continue;
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(newTrack).catch((e) => console.warn("[WebRTC] replaceTrack error:", e));
      } else if (newTrack) {
        try {
          pc.addTrack(newTrack, this.localStream || this.screenStream);
        } catch (e) {
          console.warn("[WebRTC] addTrack error:", e);
        }
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
        try {
          pc.addTrack(track, activeStream);
        } catch (e) {
          console.warn(`[WebRTC] Failed to add track to peer ${remoteSocketId}:`, e);
        }
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit(this.signalEvent, {
          toSocketId: remoteSocketId,
          signalData: event.candidate,
          type: "candidate"
        });
      }
    };

    // Remote track arrival handling
    pc.ontrack = (event) => {
      let remoteStream = this.remoteStreams.get(remoteSocketId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        this.remoteStreams.set(remoteSocketId, remoteStream);
      }

      if (event.track) {
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        event.track.onunmute = () => {
          if (this.onRemoteStream) {
            this.onRemoteStream(remoteSocketId, remoteStream);
          }
        };
      } else if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(remoteSocketId, remoteStream);
      }
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(remoteSocketId);
      }
    };

    // If initiator, generate SDP offer explicitly
    if (isInitiator) {
      (async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          if (pc.signalingState !== "closed") {
            await pc.setLocalDescription(offer);
            this.socket.emit(this.signalEvent, {
              toSocketId: remoteSocketId,
              signalData: offer,
              type: "offer"
            });
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to create offer for ${remoteSocketId}:`, err);
        }
      })();
    }

    return pc;
  }

  /**
   * Process incoming WebRTC signaling message
   */
  async handleSignal(fromSocketId, signalData, type) {
    try {
      let pc = this.peers.get(fromSocketId);

      if (type === "offer") {
        if (!pc) {
          pc = this.createPeerConnection(fromSocketId, false);
        }

        // Avoid invalid state if duplicate offer arrives when already processing or stable
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
          console.warn(`[WebRTC] Ignoring offer in unexpected signalingState: ${pc.signalingState}`);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signalData));

        // Process any queued candidates
        if (this.pendingCandidates.has(fromSocketId)) {
          const queued = this.pendingCandidates.get(fromSocketId);
          for (const candidate of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
              console.warn("[WebRTC] Candidate error:", e)
            );
          }
          this.pendingCandidates.delete(fromSocketId);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit(this.signalEvent, {
          toSocketId: fromSocketId,
          signalData: answer,
          type: "answer"
        });
      } else if (type === "answer") {
        if (pc) {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData));

            if (this.pendingCandidates.has(fromSocketId)) {
              const queued = this.pendingCandidates.get(fromSocketId);
              for (const candidate of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                  console.warn("[WebRTC] Candidate error:", e)
                );
              }
              this.pendingCandidates.delete(fromSocketId);
            }
          } else {
            console.debug(`[WebRTC] Ignoring duplicate/unexpected answer in state: ${pc.signalingState}`);
          }
        }
      } else if (type === "candidate") {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData)).catch((e) =>
            console.warn("[WebRTC] addIceCandidate error:", e)
          );
        } else {
          if (!this.pendingCandidates.has(fromSocketId)) {
            this.pendingCandidates.set(fromSocketId, []);
          }
          this.pendingCandidates.get(fromSocketId).push(signalData);
        }
      }
    } catch (err) {
      console.error(`[WebRTC] handleSignal error for ${fromSocketId} (${type}):`, err);
    }
  }

  removePeer(socketId) {
    const pc = this.peers.get(socketId);
    if (pc) {
      pc.close();
      this.peers.delete(socketId);
    }
    const stream = this.remoteStreams.get(socketId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteStreams.delete(socketId);
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
    for (const [, stream] of this.remoteStreams.entries()) {
      stream.getTracks().forEach((t) => t.stop());
    }
    this.peers.clear();
    this.remoteStreams.clear();
    this.pendingCandidates.clear();
  }
}
