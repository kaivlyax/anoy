import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { communityApi, communityChatApi, meetingRoomApi, mediaApi, postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import ProBadge from "../components/ProBadge";
import AvatarFrame from "../components/AvatarFrame";
import PostCard from "../components/PostCard";
import PostComposer from "../components/PostComposer";
import ImageLightboxModal from "../components/ImageLightboxModal";
import {
  UsersIcon,
  SparklesIcon,
  ShieldIcon,
  TrashIcon,
  LoaderIcon,
  XIcon,
  SendIcon,
  PaperclipIcon,
  MessageCircleIcon,
  HashIcon,
  LockIcon,
  PlusIcon,
  CameraIcon,
  SearchIcon,
  GraduationCapIcon,
  VideoIcon
} from "../components/Icons";

const COMMUNITY_CHANNELS = [
  { id: "general", label: "general", desc: "General chat & discussions" },
  { id: "announcements", label: "announcements", desc: "Updates & notices" },
  { id: "study-lounge", label: "study-lounge", desc: "Study questions & help" }
];

export default function CommunityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();

  const [community, setCommunity] = useState(null);
  const [boosters, setBoosters] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'feed' | 'members' | 'moderation' | 'decorations'
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  // Settings & Moderation state
  const [modTargetUsername, setModTargetUsername] = useState("");
  const [addingMod, setAddingMod] = useState(false);

  // Community Chat State
  const [activeChannel, setActiveChannel] = useState("general");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [lightboxData, setLightboxData] = useState({ isOpen: false, url: "", name: "" });

  const chatFileInputRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Meeting Rooms State
  const isProUser = Boolean(
    profile?.isPro && (!profile?.proExpiresAt || new Date(profile?.proExpiresAt) > new Date())
  );
  const maxAllowedCapacity = isProUser ? 15 : 5;

  const [meetingRooms, setMeetingRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomMax, setNewRoomMax] = useState(5);
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomPasscode, setNewRoomPasscode] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Passcode prompt for locked meeting rooms
  const [promptRoom, setPromptRoom] = useState(null);
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);

  const fetchCommunityData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await communityApi.getCommunity(slug);
      if (res.data.success) {
        setCommunity(res.data.community);

        // Fetch boosters
        try {
          const bRes = await communityApi.getBoosters(res.data.community._id);
          if (bRes.data.success) {
            setBoosters(bRes.data.boosters);
          }
        } catch {
          // ignore
        }

        // Fetch posts for feed
        try {
          const pRes = await postApi.getExploreFeed(1, 10);
          if (pRes.data.success) {
            setPosts(pRes.data.posts || []);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Fetch community error:", err);
      addToast(err.response?.data?.message || "Community not found", "error");
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate, addToast]);

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  // Scroll chat to bottom
  const scrollChatToBottom = (behavior = "smooth") => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch channel messages
  const fetchChannelMessages = useCallback(
    async (channelName) => {
      if (!community?._id) return;
      try {
        setChatLoading(true);
        const res = await communityChatApi.getMessages(community._id, channelName, 1, 50);
        if (res.data.success) {
          setChatMessages(res.data.messages || []);
          setTimeout(() => scrollChatToBottom("auto"), 50);
        }
      } catch (err) {
        console.warn("Fetch community messages error:", err);
      } finally {
        setChatLoading(false);
      }
    },
    [community]
  );

  // When community or activeChannel changes, join socket room & fetch messages
  useEffect(() => {
    if (!community?._id || activeTab !== "chat") return;

    fetchChannelMessages(activeChannel);
    setSelectedImage(null);
    setImagePreview(null);
    setTypingUsers(new Set());

    if (socket && isConnected) {
      socket.emit("join_community_chat", {
        communityId: community._id,
        channel: activeChannel
      });
    }

    return () => {
      if (socket && isConnected) {
        socket.emit("leave_community_chat", {
          communityId: community._id,
          channel: activeChannel
        });
      }
    };
  }, [community?._id, activeChannel, activeTab, socket, isConnected, fetchChannelMessages]);

  // Socket event listeners for community chat
  useEffect(() => {
    if (!socket || !community?._id) return;

    const handleNewCommunityMsg = ({ communityId, channel, message }) => {
      if (communityId === community._id && channel === activeChannel) {
        setChatMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollChatToBottom("smooth"), 50);
      }
    };

    const handleCommunityMsgDeleted = ({ communityId, channel, messageId }) => {
      if (communityId === community._id && channel === activeChannel) {
        setChatMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    const handleTypingStart = ({ communityId, channel, userId, displayName, username }) => {
      if (communityId === community._id && channel === activeChannel && userId !== user?.id && userId !== user?._id) {
        setTypingUsers((prev) => new Set([...prev, displayName || username]));
        setTimeout(() => scrollChatToBottom("smooth"), 50);
      }
    };

    const handleTypingStop = ({ communityId, channel, displayName, username }) => {
      if (communityId === community._id && channel === activeChannel) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(displayName || username);
          return next;
        });
      }
    };

    socket.on("new_community_message", handleNewCommunityMsg);
    socket.on("community_message_deleted", handleCommunityMsgDeleted);
    socket.on("community_typing:start", handleTypingStart);
    socket.on("community_typing:stop", handleTypingStop);

    return () => {
      socket.off("new_community_message", handleNewCommunityMsg);
      socket.off("community_message_deleted", handleCommunityMsgDeleted);
      socket.off("community_typing:start", handleTypingStart);
      socket.off("community_typing:stop", handleTypingStop);
    };
  }, [socket, community?._id, activeChannel, user]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select an image file (JPG, PNG, WEBP, GIF).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size must be less than 5MB.", "error");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCancelImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = "";
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    if (!socket || !isConnected || !community?._id) return;

    socket.emit("community_typing:start", {
      communityId: community._id,
      channel: activeChannel
    });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("community_typing:stop", {
        communityId: community._id,
        channel: activeChannel
      });
    }, 2000);
  };

  const handleSendCommunityMessage = async (e) => {
    e.preventDefault();
    if ((!chatInput.trim() && !selectedImage) || !community?._id || chatSending) return;

    try {
      setChatSending(true);

      let uploadedMedia = null;
      if (selectedImage) {
        const formData = new FormData();
        formData.append("image", selectedImage);
        const uploadRes = await mediaApi.uploadImage(formData);
        if (uploadRes.data.success) {
          uploadedMedia = uploadRes.data.media;
        } else {
          throw new Error("Failed to upload image.");
        }
      }

      const payload = {
        communityId: community._id,
        channel: activeChannel,
        content: chatInput.trim(),
        messageType: uploadedMedia ? "IMAGE" : "TEXT",
        mediaUrl: uploadedMedia?.url || "",
        mediaMeta: uploadedMedia || {}
      };

      if (socket && isConnected) {
        socket.emit("send_community_message", payload, (res) => {
          if (!res?.success) {
            communityChatApi.sendMessage(community._id, payload);
          }
        });
      } else {
        const res = await communityChatApi.sendMessage(community._id, payload);
        if (res.data.success) {
          setChatMessages((prev) => [...prev, res.data.message]);
          setTimeout(() => scrollChatToBottom("smooth"), 50);
        }
      }

      setChatInput("");
      handleCancelImage();
    } catch (err) {
      console.error("Send community message error:", err);
      addToast(err.response?.data?.message || err.message || "Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const handleDeleteCommunityMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      if (socket && isConnected) {
        socket.emit("delete_community_message", {
          communityId: community._id,
          channel: activeChannel,
          messageId
        });
      } else {
        await communityChatApi.deleteMessage(community._id, messageId);
        setChatMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
      addToast("Message deleted", "info");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete message", "error");
    }
  };

  const handleJoinLeave = async () => {
    if (!community) return;
    try {
      if (community.userRole === "NONE") {
        const res = await communityApi.joinCommunity(community._id);
        if (res.data.success) {
          addToast(`Joined ${community.name}!`, "success");
          fetchCommunityData();
        }
      } else {
        const res = await communityApi.leaveCommunity(community._id);
        if (res.data.success) {
          addToast(`Left ${community.name}`, "info");
          fetchCommunityData();
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Action failed", "error");
    }
  };

  const handleBoost = async () => {
    if (!community) return;
    if (!isProUser) {
      addToast("You must be an ANOY Pro member to boost communities!", "warning");
      navigate("/store");
      return;
    }

    try {
      setBoosting(true);
      const res = await communityApi.boostCommunity(community._id);
      if (res.data.success) {
        addToast(res.data.message || "Community boosted!", "success");
        setShowBoostModal(false);
        fetchCommunityData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to boost community", "error");
    } finally {
      setBoosting(false);
    }
  };

  const handleAddModerator = async (e) => {
    e.preventDefault();
    if (!modTargetUsername.trim()) return;

    try {
      setAddingMod(true);
      const target = community.members.find(
        (m) => m.username?.toLowerCase() === modTargetUsername.trim().toLowerCase()
      );

      if (!target) {
        addToast("User must be a member of this community first", "error");
        return;
      }

      const res = await communityApi.addModerator(community._id, target._id);
      if (res.data.success) {
        addToast(res.data.message || "Moderator added!", "success");
        setModTargetUsername("");
        fetchCommunityData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to add moderator", "error");
    } finally {
      setAddingMod(false);
    }
  };

  const handleRemoveModerator = async (targetUserId) => {
    try {
      const res = await communityApi.removeModerator(community._id, targetUserId);
      if (res.data.success) {
        addToast("Moderator removed", "info");
        fetchCommunityData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to remove moderator", "error");
    }
  };

  // Fetch meeting rooms for this community
  const fetchMeetingRooms = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingRooms(true);
      const res = await meetingRoomApi.getCommunityRooms(community._id);
      if (res.data.success) {
        setMeetingRooms(res.data.meetingRooms || []);
      }
    } catch (err) {
      console.warn("Fetch meeting rooms error:", err);
    } finally {
      setLoadingRooms(false);
    }
  }, [community?._id]);

  useEffect(() => {
    if (activeTab === "rooms") {
      fetchMeetingRooms();
    }
  }, [activeTab, fetchMeetingRooms]);

  const handleCreateMeetingRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || !community?._id || creatingRoom) return;

    try {
      setCreatingRoom(true);
      const effectiveMax = Math.min(Math.max(Number(newRoomMax) || maxAllowedCapacity, 2), maxAllowedCapacity);
      const payload = {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        maxParticipants: effectiveMax,
        isPrivate: Boolean(newRoomPrivate),
        passcode: newRoomPrivate ? newRoomPasscode.trim() : ""
      };

      const res = await meetingRoomApi.createRoom(community._id, payload);
      if (res.data.success) {
        addToast("Meeting room created!", "success");
        setShowCreateRoomModal(false);
        setNewRoomName("");
        setNewRoomDesc("");
        setNewRoomMax(maxAllowedCapacity);
        setNewRoomPrivate(false);
        setNewRoomPasscode("");
        fetchMeetingRooms();

        navigate(`/communities/${slug}/meeting-rooms/${res.data.meetingRoom._id}`, {
          state: { passcode: payload.passcode }
        });
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to create meeting room", "error");
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinMeetingRoomClick = (room) => {
    if (room.isPrivate && room.hasPasscode) {
      setPromptRoom(room);
      setEnteredPasscode("");
    } else {
      navigate(`/communities/${slug}/meeting-rooms/${room._id}`);
    }
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (!promptRoom || joiningRoom) return;

    try {
      setJoiningRoom(true);
      const res = await meetingRoomApi.joinRoom(promptRoom._id, enteredPasscode);
      if (res.data.success) {
        const targetRoomId = promptRoom._id;
        const passcode = enteredPasscode;
        setPromptRoom(null);
        setEnteredPasscode("");
        navigate(`/communities/${slug}/meeting-rooms/${targetRoomId}`, {
          state: { passcode }
        });
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Incorrect passcode", "error");
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleDeleteMeetingRoom = async (roomId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to end/delete this meeting room?")) return;

    try {
      const res = await meetingRoomApi.deleteRoom(roomId);
      if (res.data.success) {
        addToast("Meeting room closed", "info");
        fetchMeetingRooms();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete meeting room", "error");
    }
  };

  const filteredMeetingRooms = meetingRooms.filter((r) => {
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    );
  });

  if (loading || !community) {
    return (
      <div className="community-loading-state">
        <LoaderIcon size={36} />
        <span>Loading community...</span>
      </div>
    );
  }

  const isOwner = community.userRole === "OWNER";
  const isMod = community.userRole === "MODERATOR" || isOwner;
  const isMember = community.userRole !== "NONE";

  return (
    <div className="community-detail-page">
      {/* Lightbox for Image viewing */}
      <ImageLightboxModal
        isOpen={lightboxData.isOpen}
        imageUrl={lightboxData.url}
        originalName={lightboxData.name}
        onClose={() => setLightboxData({ isOpen: false, url: "", name: "" })}
      />

      {/* Hidden File Picker for Community Chat */}
      <input
        type="file"
        ref={chatFileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
      />

      {/* Cover Banner */}
      <div
        className="community-cover-banner"
        style={{
          backgroundImage: community.coverImage ? `url(${community.coverImage})` : undefined,
          background: !community.coverImage ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" : undefined
        }}
      >
        {community.isBoosted && (
          <div className="banner-boost-pill">
            🚀 Boosted Level {community.boostLevel} ({community.boostCount} Boosts)
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className="community-header-card">
        <div className="comm-header-top-row">
          <div className="comm-header-avatar-col">
            <div className={`comm-detail-avatar ${community.activeDecorations?.iconFrame || ""}`}>
              {community.avatar ? (
                <img src={community.avatar} alt={community.name} />
              ) : (
                <span>{community.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="comm-header-actions">
            <button
              type="button"
              className="btn-boost-comm"
              onClick={() => setShowBoostModal(true)}
            >
              <SparklesIcon size={16} />
              <span>Boost Community</span>
            </button>

            {isOwner ? (
              <span className="role-owner-pill">Owner</span>
            ) : (
              <button
                type="button"
                className={`btn-join-toggle ${community.userRole !== "NONE" ? "joined" : "join"}`}
                onClick={handleJoinLeave}
              >
                {community.userRole !== "NONE" ? "Joined" : "Join Community"}
              </button>
            )}
          </div>
        </div>

        <div className="comm-header-details">
          <div className="comm-title-row">
            <h1 className="comm-main-title">{community.name}</h1>
            {community.isPrivate && (
              <span className="private-comm-pill" title="Private Community">
                <LockIcon size={13} /> Private
              </span>
            )}
            {community.isBoosted && (
              <span className="boost-lvl-badge">Level {community.boostLevel}</span>
            )}
          </div>
          <span className="comm-slug-handle">@{community.slug}</span>
          <p className="comm-full-desc">{community.description || "Welcome to our community on ANOY."}</p>

          <div className="comm-meta-badges">
            <div className="meta-badge">
              <UsersIcon size={15} />
              <span>{community.memberCount} Members</span>
            </div>
            <div className="meta-badge">
              <ShieldIcon size={15} />
              <span>Created by @{community.owner?.username}</span>
              {community.owner?.isPro && <ProBadge size="sm" />}
            </div>
            {community.isBoosted && (
              <div className="meta-badge boost-meta">
                <span>🚀 {community.boostCount} Total Boosts</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="comm-tabs-nav">
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Live Chat
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "rooms" ? "active" : ""}`}
          onClick={() => setActiveTab("rooms")}
        >
          🎓 Meeting Rooms ({meetingRooms.length})
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "feed" ? "active" : ""}`}
          onClick={() => setActiveTab("feed")}
        >
          Discussion & Feed
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Members ({community.memberCount})
        </button>
        {isMod && (
          <button
            type="button"
            className={`comm-tab-btn ${activeTab === "moderation" ? "active" : ""}`}
            onClick={() => setActiveTab("moderation")}
          >
            Moderation & Roles
          </button>
        )}
      </div>

      {/* TAB CONTENT */}
      <div className="comm-tab-content">
        {/* TAB 0: LIVE COMMUNITY CHAT */}
        {activeTab === "chat" && (
          <div className="comm-chat-container">
            {/* Left Channels Sidebar */}
            <div className="comm-channels-sidebar">
              <div className="comm-channels-header">
                <span>TEXT CHANNELS</span>
              </div>
              <div className="comm-channels-list">
                {COMMUNITY_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`comm-channel-btn ${activeChannel === ch.id ? "active" : ""}`}
                    onClick={() => setActiveChannel(ch.id)}
                  >
                    <HashIcon size={16} />
                    <span>{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Chat Stream */}
            <div className="comm-chat-main">
              <div className="comm-chat-top-header">
                <HashIcon size={18} />
                <strong>{activeChannel}</strong>
                <span className="channel-desc">
                  {COMMUNITY_CHANNELS.find((c) => c.id === activeChannel)?.desc}
                </span>
              </div>

              {/* Message Stream */}
              <div className="comm-chat-stream">
                {chatLoading ? (
                  <div className="chat-loading-spinner">
                    <LoaderIcon size={28} />
                    <span>Loading channel messages...</span>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="comm-chat-empty">
                    <MessageCircleIcon size={38} />
                    <h3>Welcome to #{activeChannel}!</h3>
                    <p>This is the start of the #{activeChannel} channel.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMine =
                      msg.sender?._id === user?.id ||
                      msg.sender?._id === user?._id ||
                      msg.sender?.username === user?.username;

                    const role = msg.sender?.communityRole;

                    return (
                      <div key={msg._id} className="comm-chat-message-row">
                        <AvatarFrame decoration={msg.sender?.avatarDecoration} size="sm">
                          {msg.sender?.avatar ? (
                            <img src={msg.sender.avatar} alt={msg.sender.displayName} className="comm-msg-avatar" />
                          ) : (
                            <div className="comm-msg-placeholder">
                              {(msg.sender?.displayName || msg.sender?.username || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </AvatarFrame>

                        <div className="comm-msg-content-wrapper">
                          <div className="comm-msg-header">
                            <span className="comm-msg-author">{msg.sender?.displayName || msg.sender?.username}</span>
                            {msg.sender?.isPro && <ProBadge size="sm" />}
                            {role === "OWNER" && <span className="comm-role-tag owner">👑 Owner</span>}
                            {role === "MODERATOR" && <span className="comm-role-tag mod">🛡️ Mod</span>}
                            <span className="comm-msg-time">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>

                            {/* Delete button if author or owner/mod */}
                            {(isMine || isMod) && (
                              <button
                                type="button"
                                className="comm-msg-delete-btn"
                                onClick={() => handleDeleteCommunityMessage(msg._id)}
                                title="Delete message"
                                aria-label="Delete message"
                              >
                                <TrashIcon size={13} />
                              </button>
                            )}
                          </div>

                          {msg.messageType === "IMAGE" && msg.mediaUrl && (
                            <div
                              className="comm-msg-image-box"
                              onClick={() =>
                                setLightboxData({
                                  isOpen: true,
                                  url: msg.mediaUrl,
                                  name: msg.mediaMeta?.originalName || "Community image"
                                })
                              }
                            >
                              <img src={msg.mediaUrl} alt="Attachment" className="comm-msg-attached-img" loading="lazy" />
                            </div>
                          )}

                          {msg.content && <p className="comm-msg-text">{msg.content}</p>}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="comm-typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-names">
                      {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* Image Preview before sending */}
              {imagePreview && (
                <div className="image-preview-bar">
                  <div className="image-preview-thumb-wrapper">
                    <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                    <button
                      type="button"
                      className="image-preview-cancel-btn"
                      onClick={handleCancelImage}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <div className="image-preview-details">
                    <span className="image-preview-name">{selectedImage?.name}</span>
                    <span className="image-preview-size">
                      {selectedImage?.size ? `${(selectedImage.size / 1024).toFixed(1)} KB` : ""}
                    </span>
                  </div>
                </div>
              )}

              {/* Chat Composer */}
              {community.isPrivate && !isMember ? (
                <div className="comm-chat-locked-bar">
                  <LockIcon size={16} />
                  <span>Join this community to send messages and share images in #{activeChannel}.</span>
                </div>
              ) : (
                <form className="comm-chat-composer" onSubmit={handleSendCommunityMessage}>
                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={() => chatFileInputRef.current?.click()}
                    title="Share Image"
                    aria-label="Attach Image"
                    disabled={chatSending}
                  >
                    <PaperclipIcon size={18} />
                  </button>

                  <input
                    type="text"
                    className="comm-chat-input"
                    placeholder={`Message #${activeChannel}...`}
                    value={chatInput}
                    onChange={handleChatInputChange}
                    disabled={chatSending}
                  />

                  <button
                    type="submit"
                    className="comm-chat-send-btn"
                    disabled={(!chatInput.trim() && !selectedImage) || chatSending}
                    aria-label="Send message"
                  >
                    {chatSending ? <LoaderIcon size={16} /> : <SendIcon size={16} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: FEED */}
        {activeTab === "feed" && (
          <div className="comm-feed-layout">
            <PostComposer onPostCreated={(newPost) => setPosts([newPost, ...posts])} />
            <div className="comm-post-stream" style={{ marginTop: 20 }}>
              {posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onPostDeleted={(id) => setPosts(posts.filter((p) => p._id !== id))}
                />
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === "members" && (
          <div className="comm-members-layout">
            {boosters.length > 0 && (
              <div className="boosters-box">
                <h4>🚀 Community Boosters</h4>
                <div className="boosters-row">
                  {boosters.map((b) => (
                    <div key={b._id} className="booster-chip">
                      <AvatarFrame
                        src={b.booster?.avatar}
                        fallbackText={b.booster?.displayName || "A"}
                        size={28}
                        frame={b.booster?.avatarDecoration}
                      />
                      <span>@{b.booster?.username}</span>
                      {b.booster?.isPro && <ProBadge size="sm" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="member-role-section">
              <h4 className="role-heading">👑 Owner</h4>
              <div className="member-card">
                <AvatarFrame
                  src={community.owner?.avatar}
                  fallbackText={community.owner?.displayName || "A"}
                  size={40}
                  frame={community.owner?.avatarDecoration}
                />
                <div className="member-info">
                  <div className="member-name-row">
                    <strong>{community.owner?.displayName}</strong>
                    {community.owner?.isPro && <ProBadge size="sm" />}
                  </div>
                  <span className="member-handle">@{community.owner?.username}</span>
                </div>
              </div>
            </div>

            {community.moderators?.length > 0 && (
              <div className="member-role-section">
                <h4 className="role-heading">🛡️ Moderators ({community.moderators.length})</h4>
                <div className="members-grid">
                  {community.moderators.map((mod) => (
                    <div key={mod._id} className="member-card">
                      <AvatarFrame
                        src={mod.avatar}
                        fallbackText={mod.displayName || "A"}
                        size={40}
                      />
                      <div className="member-info">
                        <div className="member-name-row">
                          <strong>{mod.displayName}</strong>
                          {mod.isPro && <ProBadge size="sm" />}
                        </div>
                        <span className="member-handle">@{mod.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: MEETING ROOMS */}
        {activeTab === "rooms" && (
          <div className="comm-meeting-rooms-tab">
            <div className="comm-rooms-toolbar">
              <div className="comm-rooms-search">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Search meeting rooms..."
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                />
              </div>

              {(!community.isPrivate || isMember) && (
                <button
                  type="button"
                  className="btn-create-comm-room"
                  onClick={() => setShowCreateRoomModal(true)}
                >
                  <PlusIcon size={16} />
                  <span>Create Meeting Room</span>
                </button>
              )}
            </div>

            {loadingRooms ? (
              <div className="comm-rooms-loading">
                <LoaderIcon size={30} />
                <span>Loading active meeting rooms...</span>
              </div>
            ) : filteredMeetingRooms.length === 0 ? (
              <div className="comm-rooms-empty">
                <GraduationCapIcon size={44} />
                <h3>No Active Meeting Rooms</h3>
                <p>
                  Create a room to collaborate, discuss coursework, or hold live team meetings with fellow members.
                </p>
                {(!community.isPrivate || isMember) && (
                  <button
                    type="button"
                    className="btn-create-first-room"
                    onClick={() => setShowCreateRoomModal(true)}
                  >
                    + Start a Meeting Room
                  </button>
                )}
              </div>
            ) : (
              <div className="comm-rooms-grid">
                {filteredMeetingRooms.map((room) => {
                  const isCreator =
                    room.createdBy?._id === user?.id ||
                    room.createdBy?._id === user?._id ||
                    room.createdBy?.username === user?.username;

                  const canDelete = isCreator || isOwner || isMod;
                  const activeCount = room.activeParticipants?.length || 0;

                  return (
                    <div
                      key={room._id}
                      className="comm-room-card"
                      onClick={() => handleJoinMeetingRoomClick(room)}
                    >
                      <div className="comm-room-card-header">
                        <div className="comm-room-badge-row">
                          <span className="comm-room-live-pill">
                            <span className="live-dot" />
                            {activeCount} / {room.maxParticipants || 10} Online
                          </span>
                          {room.isPrivate && (
                            <span className="comm-room-locked-pill" title="Passcode protected">
                              <LockIcon size={12} /> Protected
                            </span>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            type="button"
                            className="comm-room-del-btn"
                            onClick={(e) => handleDeleteMeetingRoom(room._id, e)}
                            title="End meeting room"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>

                      <h3 className="comm-room-title">{room.name}</h3>
                      <p className="comm-room-desc">
                        {room.description || "Live community meeting and video collaboration room."}
                      </p>

                      <div className="comm-room-card-footer">
                        <div className="comm-room-host-info">
                          <AvatarFrame decoration={room.createdBy?.avatarDecoration} size="sm">
                            {room.createdBy?.avatar ? (
                              <img
                                src={room.createdBy.avatar}
                                alt={room.createdBy.displayName || "Host"}
                                className="comm-room-host-img"
                              />
                            ) : (
                              <div className="comm-room-host-placeholder">
                                {(room.createdBy?.displayName || room.createdBy?.username || "H")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                          </AvatarFrame>
                          <span className="comm-room-host-name">
                            Host: @{room.createdBy?.username || "anonymous"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn-join-room-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinMeetingRoomClick(room);
                          }}
                        >
                          <VideoIcon size={15} />
                          <span>Join Room</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MODERATION */}
        {activeTab === "moderation" && isMod && (
          <div className="comm-moderation-layout">
            <h3>🛡️ Community Management</h3>
            <div className="add-mod-box">
              <h4>Appoint Moderator</h4>
              <form onSubmit={handleAddModerator} className="add-mod-form">
                <input
                  type="text"
                  placeholder="Enter member's exact username..."
                  value={modTargetUsername}
                  onChange={(e) => setModTargetUsername(e.target.value)}
                  className="add-mod-input"
                />
                <button type="submit" className="add-mod-submit-btn" disabled={addingMod}>
                  {addingMod ? <LoaderIcon size={16} /> : "Add Mod"}
                </button>
              </form>
            </div>

            <div className="current-mods-list">
              <h4>Current Moderators</h4>
              {community.moderators?.map((m) => (
                <div key={m._id} className="mod-list-row">
                  <span>@{m.username} ({m.displayName})</span>
                  {isOwner && (
                    <button
                      type="button"
                      className="btn-remove-mod"
                      onClick={() => handleRemoveModerator(m._id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Meeting Room Modal */}
      {showCreateRoomModal && (
        <div className="create-room-modal-overlay">
          <div className="create-room-modal-card">
            <div className="create-room-modal-header">
              <h3>Create Community Meeting Room</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCreateRoomModal(false)}
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMeetingRoom} className="create-room-form">
              <div className="form-group">
                <label>Room Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201 Midterm Study Session"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="form-group">
                <label>Topic / Description</label>
                <textarea
                  placeholder="What is this meeting room for?"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label>Max Capacity: {newRoomMax} Participants</label>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isProUser ? "#a855f7" : "#94a3b8" }}>
                    {isProUser ? "⭐ Pro Tier (Max 15)" : "Free Tier (Max 5)"}
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={maxAllowedCapacity}
                  value={Math.min(newRoomMax, maxAllowedCapacity)}
                  onChange={(e) => setNewRoomMax(Math.min(Number(e.target.value), maxAllowedCapacity))}
                />
                {!isProUser && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                    Free accounts can host up to 5 participants. Upgrade to ANOY Pro for up to 15.
                  </p>
                )}
              </div>

              <div className="form-group-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newRoomPrivate}
                    onChange={(e) => setNewRoomPrivate(e.target.checked)}
                  />
                  <span>Require Passcode to Join</span>
                </label>
              </div>

              {newRoomPrivate && (
                <div className="form-group">
                  <label>Passcode *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter room passcode"
                    value={newRoomPasscode}
                    onChange={(e) => setNewRoomPasscode(e.target.value)}
                  />
                </div>
              )}

              <div className="create-room-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateRoomModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-submit"
                  disabled={!newRoomName.trim() || creatingRoom}
                >
                  {creatingRoom ? <LoaderIcon size={16} /> : "Create & Launch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passcode Prompt Modal */}
      {promptRoom && (
        <div className="passcode-modal-overlay">
          <div className="passcode-modal-card">
            <div className="passcode-modal-header">
              <h3>🔒 Enter Room Passcode</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setPromptRoom(null)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <p>"{promptRoom.name}" requires a passcode to enter.</p>

            <form onSubmit={handlePasscodeSubmit} className="passcode-form">
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter passcode..."
                value={enteredPasscode}
                onChange={(e) => setEnteredPasscode(e.target.value)}
                className="passcode-input"
              />
              <div className="passcode-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setPromptRoom(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-join-submit"
                  disabled={!enteredPasscode.trim() || joiningRoom}
                >
                  {joiningRoom ? <LoaderIcon size={16} /> : "Join Meeting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Boost Modal */}
      {showBoostModal && (
        <div className="boost-modal-overlay">
          <div className="boost-modal-card">
            <div className="boost-modal-header">
              <h3>🚀 Boost {community.name}</h3>
              <button type="button" onClick={() => setShowBoostModal(false)} className="close-btn">
                <XIcon size={18} />
              </button>
            </div>
            <p>Level up this community to unlock premium badge styling and priority ranking in explore.</p>
            <div className="boost-modal-actions">
              <button type="button" className="btn-confirm-boost" onClick={handleBoost} disabled={boosting}>
                {boosting ? <LoaderIcon size={16} /> : "Confirm 1 Boost (Pro)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
