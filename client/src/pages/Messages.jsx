import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { conversationApi, mediaApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import {
  MessageCircleIcon,
  SendIcon,
  SearchIcon,
  LoaderIcon,
  CheckIcon,
  XIcon,
  PaperclipIcon,
  TrashIcon
} from "../components/Icons";
import AvatarFrame from "../components/AvatarFrame";
import ProBadge from "../components/ProBadge";
import ImageLightboxModal from "../components/ImageLightboxModal";

function Messages() {
  const { user } = useAuth();
  const { socket, isConnected, isUserOnline } = useSocket();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedConvIdParam = searchParams.get("conversationId");

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(selectedConvIdParam || null);
  const [searchQuery, setSearchQuery] = useState("");

  // Active chat state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Lightbox State
  const [lightboxData, setLightboxData] = useState({ isOpen: false, url: "", name: "" });

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingActiveRef = useRef(false);

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
          return prev.map((c) =>
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
          ).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
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

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
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

  const activeConversation = conversations.find((c) => c._id === activeConversationId);
  const activeOtherParticipant = getOtherParticipant(activeConversation);
  const isTargetOnline = activeOtherParticipant ? isUserOnline(activeOtherParticipant._id) : false;

  const filteredConversations = conversations.filter((c) => {
    const other = getOtherParticipant(c);
    if (!other) return false;
    const name = other.displayName || other.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

      {/* Left Pane: Conversation List */}
      <div className={`conversations-sidebar ${activeConversationId ? "hide-on-mobile" : ""}`}>
        <div className="conversations-header">
          <div className="conversations-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="conversations-title" style={{ margin: 0 }}>Messages</h2>
            {conversations.length > 0 && (
              <span className="conv-total-count" style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 999 }}>
                {conversations.length} chats
              </span>
            )}
          </div>
          <div className="search-bar-unified-container">
            <div className="search-input-glass-box chat-search-glass">
              <span className="search-glass-icon">
                <SearchIcon size={15} />
              </span>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-glass-input"
                aria-label="Search conversations"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear chat search"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="conversations-list">
          {searchQuery && filteredConversations.length > 0 && (
            <div style={{ padding: "8px 16px 4px 16px", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              {filteredConversations.length} matching conversation{filteredConversations.length === 1 ? "" : "s"}
            </div>
          )}

          {loadingConversations ? (
            <div className="conversations-loading">
              <LoaderIcon size={28} />
              <span>Loading messages...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="conversations-empty">
              {searchQuery ? (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center", marginBottom: 10, color: "var(--text-muted)" }}>
                    <SearchIcon size={22} />
                  </div>
                  <p>No chats matching "{searchQuery}"</p>
                  <span className="empty-subtext">Check the spelling or start a new conversation from Search.</span>
                </>
              ) : (
                <>
                  <MessageCircleIcon size={36} />
                  <p>No conversations found</p>
                  <span className="empty-subtext">Find users in Explore or Search to start a chat.</span>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isSelected = conv._id === activeConversationId;
              const online = other ? isUserOnline(other._id) : false;
              const hasUnread = (conv.unreadCount || 0) > 0;

              return (
                <div
                  key={conv._id}
                  className={`conversation-item ${isSelected ? "active" : ""} ${hasUnread ? "unread" : ""}`}
                  onClick={() => handleSelectConversation(conv._id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="conv-avatar-wrapper">
                    <AvatarFrame decoration={other?.avatarDecoration} size="md">
                      {other?.avatar ? (
                        <img src={other.avatar} alt={other.displayName} className="conv-avatar-img" />
                      ) : (
                        <div className="conv-avatar-placeholder">
                          {(other?.displayName || other?.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </AvatarFrame>
                    {online && <span className="online-indicator-dot" title="Online" />}
                  </div>

                  <div className="conv-info">
                    <div className="conv-top-row">
                      <span className="conv-name">{other?.displayName || other?.username}</span>
                      {other?.isPro && <ProBadge size="sm" />}
                      <span className="conv-time">
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric"
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="conv-bottom-row">
                      <span className="conv-snippet">
                        {conv.lastMessage?.messageType === "IMAGE"
                          ? "📷 Image attachment"
                          : conv.lastMessage?.content || "No messages yet"}
                      </span>
                      {hasUnread && <span className="conv-unread-pill">{conv.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane: Active Chat Room */}
      <div className={`chat-room-pane ${!activeConversationId ? "empty-pane-mobile" : ""}`}>
        {activeConversationId && activeOtherParticipant ? (
          <div className="chat-room-container">
            {/* Chat Room Top Bar */}
            <div className="chat-room-header">
              <button
                type="button"
                className="mobile-back-btn"
                onClick={() => {
                  setActiveConversationId(null);
                  setSearchParams({});
                }}
                aria-label="Back to conversations"
              >
                ←
              </button>

              <Link to={`/profile/${activeOtherParticipant.username}`} className="chat-header-user">
                <AvatarFrame decoration={activeOtherParticipant.avatarDecoration} size="sm">
                  {activeOtherParticipant.avatar ? (
                    <img
                      src={activeOtherParticipant.avatar}
                      alt={activeOtherParticipant.displayName}
                      className="chat-header-avatar"
                    />
                  ) : (
                    <div className="chat-header-placeholder">
                      {(activeOtherParticipant.displayName || activeOtherParticipant.username)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </AvatarFrame>

                <div className="chat-header-details">
                  <div className="chat-header-name-row">
                    <span className="chat-header-name">
                      {activeOtherParticipant.displayName || activeOtherParticipant.username}
                    </span>
                    {activeOtherParticipant.isPro && <ProBadge size="sm" />}
                  </div>
                  <span className={`chat-header-status ${isTargetOnline ? "online" : "offline"}`}>
                    {isTargetOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </Link>
            </div>

            {/* Chat Messages Stream */}
            <div className="chat-messages-stream">
              {loadingMessages ? (
                <div className="chat-loading-spinner">
                  <LoaderIcon size={32} />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-empty-stream">
                  <MessageCircleIcon size={44} />
                  <h3>Say hello to {activeOtherParticipant.displayName || activeOtherParticipant.username}!</h3>
                  <p>Send a message or share an image to begin your conversation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine =
                    msg.sender?._id === user?.id ||
                    msg.sender?._id === user?._id ||
                    msg.sender?.username === user?.username;

                  return (
                    <div
                      key={msg._id}
                      className={`message-bubble-row ${isMine ? "mine" : "theirs"}`}
                    >
                      <div className={`message-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}>
                        {/* Image message rendering */}
                        {msg.messageType === "IMAGE" && msg.mediaUrl && (
                          <div
                            className="message-image-container"
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
                              className="message-attached-image"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Text message content */}
                        {msg.content && <p className="message-text">{msg.content}</p>}

                        {/* Metadata: Time & Read state */}
                        <div className="message-meta-row">
                          <span className="message-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                          {isMine && (
                            <span className="message-status-icon" title={msg.read ? "Read" : "Sent"}>
                              {msg.read ? <CheckIcon size={13} className="text-read" /> : <CheckIcon size={13} />}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Action (own messages only) */}
                      {isMine && (
                        <button
                          type="button"
                          className="message-delete-action"
                          onClick={() => handleDeleteMessage(msg._id)}
                          title="Delete message"
                          aria-label="Delete message"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              {/* Typing indicator bubble */}
              {isOtherTyping && (
                <div className="message-bubble-row theirs">
                  <div className="message-bubble bubble-theirs typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Bar before sending */}
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

            {/* Message Composer Bar */}
            <form className="chat-composer-form" onSubmit={handleSendMessage}>
              <button
                type="button"
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Image"
                aria-label="Attach Image"
                disabled={sending}
              >
                <PaperclipIcon size={20} />
              </button>

              <input
                type="text"
                className="chat-composer-input"
                placeholder={imagePreview ? "Add a caption..." : "Type a message..."}
                value={messageInput}
                onChange={handleInputChange}
                disabled={sending}
              />

              <button
                type="submit"
                className="chat-send-btn"
                disabled={(!messageInput.trim() && !selectedImage) || sending}
                aria-label="Send message"
              >
                {sending ? <LoaderIcon size={18} /> : <SendIcon size={18} />}
              </button>
            </form>
          </div>
        ) : (
          <div className="chat-room-placeholder">
            <MessageCircleIcon size={56} />
            <h2>Select a conversation</h2>
            <p>Choose an existing chat or search for a student to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;
