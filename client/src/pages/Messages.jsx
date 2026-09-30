import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { conversationApi, mediaApi, userApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import {
  MessageCircleIcon,
  SendIcon,
  SearchIcon,
  LoaderIcon,
  CheckIcon,
  CheckCheckIcon,
  XIcon,
  PaperclipIcon,
  TrashIcon,
  PhoneIcon,
  VideoIcon,
  SmileIcon,
  ImageIcon,
  MoreVerticalIcon,
  EditIcon,
  ArrowLeftIcon,
  UserIcon,
  PlusIcon
} from "../components/Icons";
import AvatarFrame from "../components/AvatarFrame";
import ProBadge from "../components/ProBadge";
import ImageLightboxModal from "../components/ImageLightboxModal";

// Quick emojis list for emoji popover
const QUICK_EMOJIS = ["👋", "👍", "❤️", "🔥", "😂", "✨", "🙌", "🚀", "🎉", "🇮🇳", "💯", "😊", "🙏", "🎓"];

// Helper: Format message date separator
function getDateSeparator(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

// Helper: Format conversation list timestamp
function formatConversationTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffHours < 48) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Messages() {
  const { user } = useAuth();
  const { socket, isConnected, isUserOnline } = useSocket();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedConvIdParam = searchParams.get("conversationId");

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(selectedConvIdParam || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'requests'

  // Active chat state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Quick Emoji Picker Popover state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Header Dropdown Menu state
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // New Message Compose Modal state
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [startingChatWithId, setStartingChatWithId] = useState(null);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Lightbox State
  const [lightboxData, setLightboxData] = useState({ isOpen: false, url: "", name: "" });

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingActiveRef = useRef(false);
  const userSearchTimeoutRef = useRef(null);

  // Helper: Extract other participant from a conversation
  const getOtherParticipant = useCallback(
    (conv) => {
      if (!conv || !conv.participants) return null;
      return (
        conv.participants.find(
          (p) =>
            p &&
            (p._id?.toString() !== user?.id?.toString() &&
              p._id?.toString() !== user?._id?.toString() &&
              p.username?.toLowerCase() !== user?.username?.toLowerCase())
        ) || conv.participants[0]
      );
    },
    [user]
  );

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const response = await conversationApi.getConversations();
      if (response.data.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (err) {
      console.error("Fetch conversations error:", err);
      addToast("Failed to load conversations.", "error");
    } finally {
      setLoadingConversations(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Sync active conversation when URL param changes
  useEffect(() => {
    if (selectedConvIdParam && selectedConvIdParam !== activeConversationId) {
      setActiveConversationId(selectedConvIdParam);
    }
  }, [selectedConvIdParam, activeConversationId]);

  // Scroll to bottom of message list
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch messages for active conversation
  const fetchMessages = useCallback(
    async (convId) => {
      if (!convId) return;
      try {
        setLoadingMessages(true);
        const response = await conversationApi.getMessages(convId, 1, 50);
        if (response.data.success) {
          setMessages(response.data.messages || []);
          setTimeout(() => scrollToBottom("auto"), 50);

          // Mark messages as read via socket and update local state
          if (socket && isConnected) {
            socket.emit("mark_read", { conversationId: convId });
          }

          // Clear unread count locally for this conversation
          setConversations((prev) =>
            prev.map((c) =>
              c._id === convId
                ? {
                    ...c,
                    unreadCount: 0
                  }
                : c
            )
          );
        }
      } catch (err) {
        console.error("Fetch messages error:", err);
        addToast(err.response?.data?.message || "Failed to load messages.", "error");
      } finally {
        setLoadingMessages(false);
      }
    },
    [socket, isConnected, addToast]
  );

  // When active conversation changes, join room & fetch messages
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(activeConversationId);
    setIsOtherTyping(false);
    setSelectedImage(null);
    setImagePreview(null);
    setShowHeaderMenu(false);
    setShowEmojiPicker(false);

    if (socket && isConnected) {
      socket.emit("join_conversation", { conversationId: activeConversationId });
    }

    return () => {
      if (socket && isConnected) {
        socket.emit("leave_conversation", { conversationId: activeConversationId });
      }
    };
  }, [activeConversationId, socket, isConnected, fetchMessages]);

  // Socket event listeners for real-time messages, typing, and read receipts
  useEffect(() => {
    if (!socket) return;

    // Receive new message
    const handleNewMessage = ({ conversationId, message }) => {
      if (conversationId === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom("smooth"), 50);

        // Auto mark as read if chat is actively focused
        if (isConnected) {
          socket.emit("mark_read", { conversationId: activeConversationId });
        }
      }

      // Update conversation list item
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId);
        if (exists) {
          return prev
            .map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    lastMessage: message,
                    lastMessageAt: message.createdAt || new Date().toISOString(),
                    unreadCount:
                      conversationId === activeConversationId
                        ? 0
                        : (c.unreadCount || 0) + 1
                  }
                : c
            )
            .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
        } else {
          fetchConversations();
          return prev;
        }
      });
    };

    // Receive deleted message
    const handleMessageDeleted = ({ conversationId, messageId }) => {
      if (conversationId === activeConversationId) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    // Other user started typing
    const handleTypingStart = ({ conversationId, userId }) => {
      if (conversationId === activeConversationId && userId !== user?.id && userId !== user?._id) {
        setIsOtherTyping(true);
        setTimeout(() => scrollToBottom("smooth"), 50);
      }
    };

    // Other user stopped typing
    const handleTypingStop = ({ conversationId, userId }) => {
      if (conversationId === activeConversationId && userId !== user?.id && userId !== user?._id) {
        setIsOtherTyping(false);
      }
    };

    // Messages marked as read
    const handleMessagesRead = ({ conversationId }) => {
      if (conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((m) => (!m.read ? { ...m, read: true, readAt: new Date() } : m))
        );
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("messages_read", handleMessagesRead);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("messages_read", handleMessagesRead);
    };
  }, [socket, activeConversationId, isConnected, user, fetchConversations]);

  // Image File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select a valid image file (JPG, PNG, WEBP, GIF).", "error");
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (!socket || !isConnected || !activeConversationId) return;

    if (!isTypingActiveRef.current) {
      isTypingActiveRef.current = true;
      socket.emit("typing:start", { conversationId: activeConversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingActiveRef.current = false;
      socket.emit("typing:stop", { conversationId: activeConversationId });
    }, 2000);
  };

  // Add emoji to message input
  const handleAddEmoji = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if ((!messageInput.trim() && !selectedImage) || !activeConversationId || sending) return;

    try {
      setSending(true);

      if (isTypingActiveRef.current && socket) {
        isTypingActiveRef.current = false;
        socket.emit("typing:stop", { conversationId: activeConversationId });
      }

      let uploadedMedia = null;

      // Upload image first if selected
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
        conversationId: activeConversationId,
        content: messageInput.trim(),
        messageType: uploadedMedia ? "IMAGE" : "TEXT",
        mediaUrl: uploadedMedia?.url || "",
        mediaMeta: uploadedMedia || {}
      };

      if (socket && isConnected) {
        socket.emit("send_message", payload, (response) => {
          if (!response?.success) {
            console.warn("Socket send fallback to REST", response?.message);
            conversationApi.sendMessage(activeConversationId, payload);
          }
        });
      } else {
        const response = await conversationApi.sendMessage(activeConversationId, payload);
        if (response.data.success) {
          setMessages((prev) => [...prev, response.data.message]);
          setTimeout(() => scrollToBottom("smooth"), 50);
        }
      }

      setMessageInput("");
      handleCancelImage();
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("Send message error:", err);
      addToast(err.response?.data?.message || err.message || "Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  // Delete own message
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      if (socket && isConnected) {
        socket.emit("delete_message", { conversationId: activeConversationId, messageId });
      } else {
        await conversationApi.deleteMessage(activeConversationId, messageId);
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
      addToast("Message deleted", "info");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete message", "error");
    }
  };

  const handleSelectConversation = (convId) => {
    setActiveConversationId(convId);
    setSearchParams({ conversationId: convId });
  };

  // User search for New Message modal
  const handleUserSearchChange = (query) => {
    setUserSearchQuery(query);
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);

    if (!query.trim()) {
      setUserSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    userSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await userApi.searchUsers(query.trim());
        if (res.data.success) {
          // Exclude current user from results
          const filtered = (res.data.users || []).filter(
            (u) =>
              u._id?.toString() !== user?.id?.toString() &&
              u._id?.toString() !== user?._id?.toString() &&
              u.username?.toLowerCase() !== user?.username?.toLowerCase()
          );
          setUserSearchResults(filtered);
        }
      } catch (err) {
        console.error("User search error:", err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
  };

  // Start or open conversation from New Message modal
  const handleStartChatWithUser = async (targetUser) => {
    if (!targetUser) return;
    try {
      setStartingChatWithId(targetUser._id || targetUser.id);
      const res = await conversationApi.getOrCreateConversation({
        recipientId: targetUser._id || targetUser.id,
        username: targetUser.username
      });
      if (res.data.success && res.data.conversation) {
        const newConv = res.data.conversation;
        setConversations((prev) => {
          if (!prev.some((c) => c._id === newConv._id)) {
            return [newConv, ...prev];
          }
          return prev;
        });
        handleSelectConversation(newConv._id);
        setIsComposeModalOpen(false);
        setUserSearchQuery("");
        setUserSearchResults([]);
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to start chat.", "error");
    } finally {
      setStartingChatWithId(null);
    }
  };

  const activeConversation = conversations.find((c) => c._id === activeConversationId);
  const activeOtherParticipant = getOtherParticipant(activeConversation);
  const isTargetOnline = activeOtherParticipant ? isUserOnline(activeOtherParticipant._id) : false;

  // Unread total across conversations
  const unreadConversationsCount = useMemo(() => {
    return conversations.filter((c) => (c.unreadCount || 0) > 0).length;
  }, [conversations]);

  // Filter conversations by search and tab
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const other = getOtherParticipant(c);
      if (!other) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dName = (other.displayName || "").toLowerCase();
        const uName = (other.username || "").toLowerCase();
        if (!dName.includes(q) && !uName.includes(q)) return false;
      }

      // Filter by tab
      if (activeTab === "unread") {
        return (c.unreadCount || 0) > 0;
      }
      if (activeTab === "requests") {
        return c.isRequest || false;
      }

      return true;
    });
  }, [conversations, searchQuery, activeTab, getOtherParticipant]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    let currentGroup = null;

    messages.forEach((msg, index) => {
      const dateKey = getDateSeparator(msg.createdAt);
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        currentGroup = {
          date: dateKey,
          items: []
        };
        groups.push(currentGroup);
      }

      const prevMsg = index > 0 ? messages[index - 1] : null;
      const prevSenderId = prevMsg?.sender?._id || prevMsg?.sender?.id;
      const thisSenderId = msg?.sender?._id || msg?.sender?.id;
      const isConsecutive =
        prevSenderId &&
        thisSenderId &&
        prevSenderId.toString() === thisSenderId.toString() &&
        getDateSeparator(prevMsg?.createdAt) === dateKey;

      currentGroup.items.push({
        ...msg,
        isConsecutive
      });
    });

    return groups;
  }, [messages]);

  return (
    <div className="messages-page-wrapper">
      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxData.isOpen}
        imageUrl={lightboxData.url}
        originalName={lightboxData.name}
        onClose={() => setLightboxData({ isOpen: false, url: "", name: "" })}
      />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
      />

      {/* New Message / Compose Modal */}
      {isComposeModalOpen && (
        <div className="chat-modal-backdrop" onClick={() => setIsComposeModalOpen(false)}>
          <div className="chat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <div className="chat-modal-title-box">
                <EditIcon size={20} className="text-primary" />
                <h3>New Conversation</h3>
              </div>
              <button
                type="button"
                className="chat-modal-close-btn"
                onClick={() => setIsComposeModalOpen(false)}
                aria-label="Close dialog"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="chat-modal-search-box">
              <SearchIcon size={16} className="chat-modal-search-icon" />
              <input
                type="text"
                className="chat-modal-search-input"
                placeholder="Search students by name or @username..."
                value={userSearchQuery}
                onChange={(e) => handleUserSearchChange(e.target.value)}
                autoFocus
              />
              {userSearchQuery && (
                <button
                  type="button"
                  className="chat-modal-clear-search"
                  onClick={() => handleUserSearchChange("")}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <div className="chat-modal-results">
              {searchingUsers ? (
                <div className="chat-modal-loading">
                  <LoaderIcon size={24} />
                  <span>Searching students...</span>
                </div>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((u) => (
                  <div
                    key={u._id || u.id}
                    className="chat-user-result-row"
                    onClick={() => handleStartChatWithUser(u)}
                  >
                    <AvatarFrame
                      src={u.avatar}
                      fallbackText={u.displayName || u.username}
                      size="md"
                      decoration={u.avatarDecoration}
                      isOnline={isUserOnline(u._id || u.id)}
                    />
                    <div className="chat-user-result-info">
                      <div className="chat-user-result-name-row">
                        <span className="chat-user-result-name">{u.displayName || u.username}</span>
                        {u.isPro && <ProBadge size="sm" />}
                      </div>
                      <span className="chat-user-result-handle">@{u.username}</span>
                      {u.bio && <p className="chat-user-result-bio">{u.bio}</p>}
                    </div>
                    <button
                      type="button"
                      className="chat-user-start-btn glow-button"
                      disabled={startingChatWithId === (u._id || u.id)}
                    >
                      {startingChatWithId === (u._id || u.id) ? (
                        <LoaderIcon size={14} />
                      ) : (
                        "Chat"
                      )}
                    </button>
                  </div>
                ))
              ) : userSearchQuery ? (
                <div className="chat-modal-empty">
                  <UserIcon size={32} />
                  <p>No students found matching "{userSearchQuery}"</p>
                </div>
              ) : (
                <div className="chat-modal-hint">
                  <MessageCircleIcon size={36} />
                  <p>Type a student's name or handle to start a direct message.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          LEFT PANEL: CONVERSATIONS LIST (~31% width)
          ======================================================== */}
      <aside
        className={`conversations-panel ${activeConversationId ? "hide-on-mobile" : ""}`}
        aria-label="Conversations List"
      >
        {/* Top Header */}
        <div className="conversations-panel-header">
          <div className="conversations-title-bar">
            <div className="conversations-title-wrap">
              <h1 className="conversations-heading">Messages</h1>
              {conversations.length > 0 && (
                <span className="conversations-total-pill">{conversations.length}</span>
              )}
            </div>
            <button
              type="button"
              className="chat-compose-btn glow-button"
              onClick={() => setIsComposeModalOpen(true)}
              title="New Message"
              aria-label="New Message"
            >
              <EditIcon size={18} />
            </button>
          </div>

          {/* Search Conversations */}
          <div className="chat-search-container">
            <div className="chat-search-box">
              <SearchIcon size={16} className="chat-search-icon" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="chat-search-input"
                aria-label="Search conversations"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="chat-search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear chat search"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs: All / Unread / Requests */}
          <div className="chat-filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`chat-filter-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>All</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "unread"}
              className={`chat-filter-tab ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => setActiveTab("unread")}
            >
              <span>Unread</span>
              {unreadConversationsCount > 0 && (
                <span className="chat-tab-count-badge">{unreadConversationsCount}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "requests"}
              className={`chat-filter-tab ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              <span>Requests</span>
            </button>
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <div className="conversations-scroll-area">
          {loadingConversations ? (
            <div className="conversations-loading-state">
              <LoaderIcon size={28} />
              <span>Loading chats...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="conversations-empty-state">
              {searchQuery ? (
                <>
                  <div className="empty-state-icon-circle">
                    <SearchIcon size={22} />
                  </div>
                  <h3>No chats found</h3>
                  <p>No conversations matched "{searchQuery}"</p>
                </>
              ) : activeTab === "unread" ? (
                <>
                  <div className="empty-state-icon-circle">
                    <CheckIcon size={22} />
                  </div>
                  <h3>All caught up!</h3>
                  <p>You have no unread messages.</p>
                </>
              ) : activeTab === "requests" ? (
                <>
                  <div className="empty-state-icon-circle">
                    <UserIcon size={22} />
                  </div>
                  <h3>No message requests</h3>
                  <p>New message requests will appear here.</p>
                </>
              ) : (
                <>
                  <div className="empty-state-icon-circle">
                    <MessageCircleIcon size={24} />
                  </div>
                  <h3>No messages yet</h3>
                  <p>Start a conversation with friends or classmates.</p>
                  <button
                    type="button"
                    className="empty-start-chat-btn glow-button"
                    onClick={() => setIsComposeModalOpen(true)}
                  >
                    <PlusIcon size={16} />
                    <span>Start New Chat</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isSelected = conv._id === activeConversationId;
              const online = other ? isUserOnline(other._id) : false;
              const hasUnread = (conv.unreadCount || 0) > 0;
              const isOwnLastMsg =
                conv.lastMessage?.sender?._id?.toString() === user?.id?.toString() ||
                conv.lastMessage?.sender?._id?.toString() === user?._id?.toString() ||
                conv.lastMessage?.sender?.username?.toLowerCase() === user?.username?.toLowerCase();

              return (
                <div
                  key={conv._id}
                  className={`conversation-card ${isSelected ? "active" : ""} ${
                    hasUnread ? "has-unread" : ""
                  }`}
                  onClick={() => handleSelectConversation(conv._id)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Left Accent indicator for active chat */}
                  {isSelected && <div className="conv-active-indicator" />}

                  <div className="conv-card-avatar">
                    <AvatarFrame
                      src={other?.avatar}
                      fallbackText={other?.displayName || other?.username}
                      size="md"
                      decoration={other?.avatarDecoration}
                      isOnline={online}
                    />
                  </div>

                  <div className="conv-card-content">
                    <div className="conv-card-top-row">
                      <div className="conv-card-name-box">
                        <span className="conv-card-name">
                          {other?.displayName || other?.username}
                        </span>
                        {other?.isPro && <ProBadge size="sm" />}
                      </div>
                      <span className="conv-card-timestamp">
                        {formatConversationTime(conv.lastMessageAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="conv-card-bottom-row">
                      <div className="conv-card-snippet-wrap">
                        {isOwnLastMsg && (
                          <span className="conv-sent-check">
                            {conv.lastMessage?.read ? (
                              <CheckCheckIcon size={13} className="text-read" />
                            ) : (
                              <CheckIcon size={13} />
                            )}
                          </span>
                        )}
                        <span
                          className={`conv-card-snippet ${hasUnread ? "snippet-bold" : ""}`}
                        >
                          {conv.lastMessage?.messageType === "IMAGE"
                            ? "📷 Image"
                            : conv.lastMessage?.content || "Started a conversation"}
                        </span>
                      </div>

                      {hasUnread && (
                        <span className="conv-card-unread-badge">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================
          RIGHT PANEL: ACTIVE CHAT WORKSPACE (~69% width)
          ======================================================== */}
      <main
        className={`chat-workspace-pane ${!activeConversationId ? "empty-pane-mobile" : ""}`}
        aria-label="Active Chat Workspace"
      >
        {activeConversationId && activeOtherParticipant ? (
          <div className="chat-active-container">
            {/* Top Fixed Chat Header */}
            <header className="chat-fixed-header">
              <div className="chat-header-left">
                <button
                  type="button"
                  className="chat-mobile-back-btn"
                  onClick={() => {
                    setActiveConversationId(null);
                    setSearchParams({});
                  }}
                  aria-label="Back to conversations list"
                >
                  <ArrowLeftIcon size={20} />
                </button>

                <Link
                  to={`/profile/${activeOtherParticipant.username}`}
                  className="chat-header-profile-link"
                >
                  <AvatarFrame
                    src={activeOtherParticipant.avatar}
                    fallbackText={
                      activeOtherParticipant.displayName || activeOtherParticipant.username
                    }
                    size="md"
                    decoration={activeOtherParticipant.avatarDecoration}
                    isOnline={isTargetOnline}
                  />

                  <div className="chat-header-user-meta">
                    <div className="chat-header-name-row">
                      <span className="chat-header-display-name">
                        {activeOtherParticipant.displayName || activeOtherParticipant.username}
                      </span>
                      {activeOtherParticipant.isPro && <ProBadge size="sm" />}
                    </div>
                    <div className="chat-header-status-row">
                      <span
                        className={`chat-header-status-dot ${
                          isTargetOnline ? "online" : "offline"
                        }`}
                      />
                      <span className="chat-header-status-label">
                        {isTargetOnline ? "Active now" : "Offline"}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Action Buttons */}
              <div className="chat-header-actions">
                <button
                  type="button"
                  className="chat-action-btn"
                  title="Voice Call"
                  onClick={() => addToast("Voice calls connecting via WebRTC...", "info")}
                  aria-label="Voice Call"
                >
                  <PhoneIcon size={18} />
                </button>

                <button
                  type="button"
                  className="chat-action-btn"
                  title="Video Call"
                  onClick={() => addToast("Video meeting rooms available in Communities!", "info")}
                  aria-label="Video Call"
                >
                  <VideoIcon size={18} />
                </button>

                <div className="chat-more-menu-wrap">
                  <button
                    type="button"
                    className="chat-action-btn"
                    onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                    title="More Options"
                    aria-label="More Options"
                  >
                    <MoreVerticalIcon size={18} />
                  </button>

                  {showHeaderMenu && (
                    <div
                      className="chat-more-dropdown glass-panel"
                      onClick={() => setShowHeaderMenu(false)}
                    >
                      <Link
                        to={`/profile/${activeOtherParticipant.username}`}
                        className="chat-dropdown-item"
                      >
                        <UserIcon size={16} />
                        <span>View Profile</span>
                      </Link>
                      <button
                        type="button"
                        className="chat-dropdown-item"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          addToast("Chat link copied to clipboard!", "success");
                        }}
                      >
                        <MessageCircleIcon size={16} />
                        <span>Copy Chat Link</span>
                      </button>
                      <button
                        type="button"
                        className="chat-dropdown-item text-danger"
                        onClick={() => {
                          if (window.confirm(`Clear chat with @${activeOtherParticipant.username}?`)) {
                            setMessages([]);
                            addToast("Local chat view cleared.", "info");
                          }
                        }}
                      >
                        <TrashIcon size={16} />
                        <span>Clear Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Chat Messages Stream Canvas */}
            <div className="chat-stream-canvas">
              {loadingMessages ? (
                <div className="chat-canvas-loading">
                  <LoaderIcon size={32} />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-canvas-welcome">
                  <div className="welcome-avatar-wrap">
                    <AvatarFrame
                      src={activeOtherParticipant.avatar}
                      fallbackText={
                        activeOtherParticipant.displayName || activeOtherParticipant.username
                      }
                      size="lg"
                      decoration={activeOtherParticipant.avatarDecoration}
                      isOnline={isTargetOnline}
                    />
                  </div>
                  <h2>
                    Say hello to {activeOtherParticipant.displayName || activeOtherParticipant.username}! 👋
                  </h2>
                  <p className="welcome-subtext">
                    This is the start of your direct conversation with @
                    {activeOtherParticipant.username}.
                  </p>
                  <div className="welcome-quick-replies">
                    {["Hey there! 👋", "How's it going? 😊", "Great to connect on ANOY! 🇮🇳"].map(
                      (reply, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="welcome-quick-pill"
                          onClick={() => {
                            setMessageInput(reply);
                          }}
                        >
                          {reply}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                groupedMessages.map((group, gIdx) => (
                  <div key={gIdx} className="chat-date-group">
                    {/* Date Separator Pill */}
                    <div className="chat-date-separator-wrap">
                      <span className="chat-date-separator-pill">{group.date}</span>
                    </div>

                    {/* Messages in this group */}
                    <div className="chat-group-messages">
                      {group.items.map((msg) => {
                        const isMine =
                          msg.sender?._id?.toString() === user?.id?.toString() ||
                          msg.sender?._id?.toString() === user?._id?.toString() ||
                          msg.sender?.username?.toLowerCase() === user?.username?.toLowerCase();

                        return (
                          <div
                            key={msg._id}
                            className={`msg-row ${isMine ? "msg-mine" : "msg-theirs"} ${
                              msg.isConsecutive ? "msg-consecutive" : ""
                            }`}
                          >
                            {!isMine && !msg.isConsecutive && (
                              <div className="msg-theirs-avatar">
                                <AvatarFrame
                                  src={activeOtherParticipant.avatar}
                                  fallbackText={
                                    activeOtherParticipant.displayName ||
                                    activeOtherParticipant.username
                                  }
                                  size="sm"
                                  decoration={activeOtherParticipant.avatarDecoration}
                                />
                              </div>
                            )}

                            <div
                              className={`msg-bubble ${
                                isMine ? "msg-bubble-mine" : "msg-bubble-theirs"
                              }`}
                            >
                              {/* Image Attachment */}
                              {msg.messageType === "IMAGE" && msg.mediaUrl && (
                                <div
                                  className="msg-image-attachment-box"
                                  onClick={() =>
                                    setLightboxData({
                                      isOpen: true,
                                      url: msg.mediaUrl,
                                      name: msg.mediaMeta?.originalName || "Chat image"
                                    })
                                  }
                                >
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Attachment"
                                    className="msg-attached-img"
                                    loading="lazy"
                                  />
                                </div>
                              )}

                              {/* Text content */}
                              {msg.content && <p className="msg-text-body">{msg.content}</p>}

                              {/* Metadata: Time and Read Status */}
                              <div className="msg-meta-footer">
                                <span className="msg-time-label">
                                  {new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                                {isMine && (
                                  <span
                                    className="msg-read-check"
                                    title={msg.read ? "Read" : "Sent"}
                                  >
                                    {msg.read ? (
                                      <CheckCheckIcon size={14} className="text-read" />
                                    ) : (
                                      <CheckIcon size={14} />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Delete message button on hover (own messages only) */}
                            {isMine && (
                              <button
                                type="button"
                                className="msg-delete-btn"
                                onClick={() => handleDeleteMessage(msg._id)}
                                title="Delete message"
                                aria-label="Delete message"
                              >
                                <TrashIcon size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator bubble */}
              {isOtherTyping && (
                <div className="msg-row msg-theirs msg-typing-row">
                  <div className="msg-bubble msg-bubble-theirs msg-typing-bubble">
                    <span className="msg-typing-dot" />
                    <span className="msg-typing-dot" />
                    <span className="msg-typing-dot" />
                  </div>
                  <span className="msg-typing-label">
                    {activeOtherParticipant.displayName || activeOtherParticipant.username} is typing...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Bar before sending */}
            {imagePreview && (
              <div className="chat-image-preview-dock">
                <div className="chat-preview-thumb-box">
                  <img src={imagePreview} alt="Preview" className="chat-preview-thumb" />
                  <button
                    type="button"
                    className="chat-preview-remove-btn"
                    onClick={handleCancelImage}
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
                <div className="chat-preview-info">
                  <span className="chat-preview-filename">{selectedImage?.name}</span>
                  <span className="chat-preview-filesize">
                    {selectedImage?.size ? `${(selectedImage.size / 1024).toFixed(1)} KB` : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Quick Emoji Picker Popover */}
            {showEmojiPicker && (
              <div className="chat-emoji-popover glass-panel">
                <div className="chat-emoji-grid">
                  {QUICK_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chat-emoji-btn"
                      onClick={() => handleAddEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fixed Bottom Message Composer */}
            <footer className="chat-fixed-composer">
              <form className="chat-composer-inner" onSubmit={handleSendMessage}>
                {/* File Attachment Button */}
                <button
                  type="button"
                  className="chat-composer-tool-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Image"
                  aria-label="Attach Image"
                  disabled={sending}
                >
                  <PaperclipIcon size={19} />
                </button>

                {/* Direct Image Upload Shortcut Button */}
                <button
                  type="button"
                  className="chat-composer-tool-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Photo"
                  aria-label="Upload Photo"
                  disabled={sending}
                >
                  <ImageIcon size={19} />
                </button>

                {/* Emoji Picker Button */}
                <button
                  type="button"
                  className={`chat-composer-tool-btn ${showEmojiPicker ? "active" : ""}`}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Insert Emoji"
                  aria-label="Insert Emoji"
                  disabled={sending}
                >
                  <SmileIcon size={19} />
                </button>

                {/* Text Message Input */}
                <input
                  type="text"
                  className="chat-composer-input"
                  placeholder={
                    imagePreview
                      ? "Add a caption for image..."
                      : `Message @${activeOtherParticipant.username}...`
                  }
                  value={messageInput}
                  onChange={handleInputChange}
                  disabled={sending}
                  autoComplete="off"
                />

                {/* Circular Glowing Purple/Indigo Send Button */}
                <button
                  type="submit"
                  className="chat-composer-send-btn glow-button"
                  disabled={(!messageInput.trim() && !selectedImage) || sending}
                  title="Send Message (Enter)"
                  aria-label="Send Message"
                >
                  {sending ? <LoaderIcon size={18} /> : <SendIcon size={18} />}
                </button>
              </form>
            </footer>
          </div>
        ) : (
          /* Intentional Empty Workspace State (No Chat Selected) */
          <div className="chat-workspace-placeholder">
            <div className="placeholder-art-glow">
              <div className="placeholder-icon-circle">
                <MessageCircleIcon size={52} />
              </div>
            </div>
            <h2 className="placeholder-title">Select a conversation</h2>
            <p className="placeholder-subtitle">
              Choose an existing chat from the left panel or start a new message with classmates.
            </p>
            <button
              type="button"
              className="placeholder-action-btn glow-button"
              onClick={() => setIsComposeModalOpen(true)}
            >
              <PlusIcon size={18} />
              <span>Start New Conversation</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default Messages;
