import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { aiApi } from "../services/api";
import {
  SparklesIcon,
  SendIcon,
  PlusIcon,
  TrashIcon,
  LoaderIcon,
  MessageCircleIcon,
  UserIcon,
  UsersIcon,
  CheckIcon
} from "../components/Icons";

const SUGGESTED_PROMPTS = [
  {
    icon: "🚀",
    title: "Meeting Rooms",
    prompt: "How do I create and join a Meeting Room on ANOY?"
  },
  {
    icon: "👥",
    title: "Find Communities",
    prompt: "Find computer science and developer communities on ANOY"
  },
  {
    icon: "✨",
    title: "ANOY Pro",
    prompt: "What features and perks come with ANOY Pro?"
  },
  {
    icon: "🔍",
    title: "Discover Students",
    prompt: "Find students on ANOY who know Python and Algorithms"
  },
  {
    icon: "🧠",
    title: "DSA / CS Concept",
    prompt: "Explain Binary Search with a code example in JavaScript"
  }
];

export default function AnoyAI() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load user's conversations on mount
  const loadConversations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await aiApi.getConversations();
      if (res.data.success) {
        setConversations(res.data.conversations || []);
        if (res.data.conversations?.length > 0 && !activeConversationId) {
          // Open most recent
          selectConversation(res.data.conversations[0]._id);
        }
      }
    } catch (err) {
      console.warn("Could not load AI conversations:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Select a conversation and load its messages
  const selectConversation = async (conversationId) => {
    try {
      setActiveConversationId(conversationId);
      const res = await aiApi.getMessages(conversationId);
      if (res.data.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error("Load messages error:", err);
      addToast("Failed to load conversation history", "error");
    }
  };

  // Start a fresh new chat session
  const handleStartNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    if (inputRef.current) inputRef.current.focus();
  };

  // Delete a conversation session
  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      const res = await aiApi.deleteConversation(convId);
      if (res.data.success) {
        setConversations((prev) => prev.filter((c) => c._id !== convId));
        if (activeConversationId === convId) {
          handleStartNewChat();
        }
        addToast("Chat session deleted", "info");
      }
    } catch (err) {
      addToast("Failed to delete chat session", "error");
    }
  };

  // Send a message
  const handleSendMessage = async (textToSend) => {
    const messageText = (textToSend || inputValue).trim();
    if (!messageText || loading) return;

    if (messageText.length > 1000) {
      addToast("Message exceeds maximum length of 1000 characters", "error");
      return;
    }

    const tempUserMsg = {
      _id: `temp_${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const res = await aiApi.chat({
        message: messageText,
        conversationId: activeConversationId || undefined
      });

      if (res.data.success) {
        const assistantMsg = {
          _id: `msg_${Date.now()}`,
          role: "assistant",
          content: res.data.message,
          sources: res.data.sources || [],
          createdAt: new Date().toISOString()
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (!activeConversationId && res.data.conversationId) {
          setActiveConversationId(res.data.conversationId);
          await loadConversations();
        }
      }
    } catch (err) {
      console.error("AI chat error:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to get response from ANOY AI. Please try again.";
      addToast(errorMsg, "error");
      setMessages((prev) => [
        ...prev,
        {
          _id: `err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error**: ${errorMsg}`,
          isError: true,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Safely parse inline markdown (bold, inline code) into React elements
  const renderInlineContent = (text) => {
    if (!text) return null;

    const tokenRegex = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
    const segments = text.split(tokenRegex);

    return segments.map((segment, idx) => {
      if (!segment) return null;

      if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
        return (
          <code key={idx} className="ai-inline-code">
            {segment.slice(1, -1)}
          </code>
        );
      }

      if (segment.startsWith("**") && segment.endsWith("**") && segment.length >= 4) {
        return (
          <strong key={idx}>
            {segment.slice(2, -2)}
          </strong>
        );
      }

      return segment;
    });
  };

  // Render markdown safely with code block highlights, lists, and paragraphs
  const renderMessageContent = (content) => {
    if (!content) return null;

    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).trim().split("\n");
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
        const code = language ? lines.slice(1).join("\n") : lines.join("\n");

        return (
          <div key={`code_${index}`} className="ai-code-block">
            {language && <div className="ai-code-lang">{language}</div>}
            <pre>
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      const lines = part.split("\n");
      const elements = [];
      let currentList = null; // { type: 'ul' | 'ol', items: [] }

      const flushList = () => {
        if (currentList && currentList.items.length > 0) {
          const ListComponent = currentList.type === "ol" ? "ol" : "ul";
          elements.push(
            <ListComponent
              key={`list_${elements.length}`}
              style={{ margin: "6px 0", paddingLeft: "20px" }}
            >
              {currentList.items.map((item, iIdx) => (
                <li key={iIdx} style={{ margin: "2px 0" }}>
                  {renderInlineContent(item)}
                </li>
              ))}
            </ListComponent>
          );
          currentList = null;
        }
      };

      lines.forEach((line, lIdx) => {
        const isBullet = /^\s*[-*]\s+/.test(line);
        const isNumbered = /^\s*\d+\.\s+/.test(line);

        if (isBullet) {
          if (!currentList || currentList.type !== "ul") {
            flushList();
            currentList = { type: "ul", items: [] };
          }
          currentList.items.push(line.replace(/^\s*[-*]\s+/, ""));
        } else if (isNumbered) {
          if (!currentList || currentList.type !== "ol") {
            flushList();
            currentList = { type: "ol", items: [] };
          }
          currentList.items.push(line.replace(/^\s*\d+\.\s+/, ""));
        } else {
          flushList();
          if (line.trim().length > 0) {
            elements.push(
              <p key={`p_${lIdx}`} style={{ margin: "4px 0" }}>
                {renderInlineContent(line)}
              </p>
            );
          }
        }
      });

      flushList();

      return <div key={`block_${index}`}>{elements}</div>;
    });
  };

  return (
    <div className="ai-page-wrapper">
      {/* Sidebar Sessions Drawer */}
      <div className={`ai-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="ai-drawer-header">
          <h3>Chat History</h3>
          <button
            type="button"
            className="ai-new-chat-btn"
            onClick={() => {
              handleStartNewChat();
              setDrawerOpen(false);
            }}
          >
            <PlusIcon size={14} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="ai-drawer-list">
          {conversations.length > 0 ? (
            conversations.map((conv) => (
              <div
                key={conv._id}
                className={`ai-drawer-item ${conv._id === activeConversationId ? "active" : ""}`}
                onClick={() => {
                  selectConversation(conv._id);
                  setDrawerOpen(false);
                }}
              >
                <div className="ai-drawer-title">
                  <MessageCircleIcon size={14} />
                  <span>{conv.title || "Chat Session"}</span>
                </div>
                <button
                  type="button"
                  className="ai-drawer-delete-btn"
                  title="Delete conversation"
                  onClick={(e) => handleDeleteConversation(e, conv._id)}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))
          ) : (
            <div className="ai-drawer-empty">
              <span>No past conversations</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Frame */}
      <div className="ai-main-container">
        {/* Top Chat Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <button
              type="button"
              className="ai-drawer-toggle-btn"
              onClick={() => setDrawerOpen(!drawerOpen)}
              title="Toggle chat history"
            >
              <MessageCircleIcon size={18} />
            </button>
            <div className="ai-header-branding">
              <div className="ai-avatar-badge">
                <SparklesIcon size={18} />
              </div>
              <div>
                <h2 className="ai-header-title">
                  ANOY AI <span className="ai-model-pill">Beta</span>
                </h2>
                <span className="ai-status-indicator">
                  <span className="status-dot" /> Student Platform Assistant
                </span>
              </div>
            </div>
          </div>

          <div className="ai-header-actions">
            <button
              type="button"
              className="ai-action-btn"
              onClick={handleStartNewChat}
              title="Start a new chat"
            >
              <PlusIcon size={16} />
              <span className="hide-mobile">New Chat</span>
            </button>
          </div>
        </div>

        {/* Message Viewport */}
        <div className="ai-messages-viewport">
          {messages.length === 0 ? (
            <div className="ai-welcome-hero">
              <div className="ai-welcome-avatar">
                <SparklesIcon size={36} />
              </div>
              <h1 className="ai-welcome-title">How can I help you today?</h1>
              <p className="ai-welcome-subtitle">
                Ask me about ANOY features, find student communities, discover peers, or ask technical & academic questions.
              </p>

              <div className="ai-suggested-prompts-grid">
                {SUGGESTED_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="ai-prompt-card"
                    onClick={() => handleSendMessage(item.prompt)}
                  >
                    <div className="prompt-card-icon">{item.icon}</div>
                    <div className="prompt-card-body">
                      <div className="prompt-card-title">{item.title}</div>
                      <div className="prompt-card-text">{item.prompt}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-messages-list">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`ai-message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="ai-message-avatar">
                      <SparklesIcon size={16} />
                    </div>
                  )}

                  <div className={`ai-message-bubble ${msg.role} ${msg.isError ? "error-bubble" : ""}`}>
                    {renderMessageContent(msg.content)}

                    {/* Source Chips */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="ai-sources-container">
                        <span className="sources-label">Referenced on ANOY:</span>
                        <div className="sources-chips-row">
                          {msg.sources.map((src, sIdx) => {
                            if (src.type === "community") {
                              return (
                                <Link
                                  key={sIdx}
                                  to={`/communities/${src.id}`}
                                  className="ai-source-chip community"
                                >
                                  <UsersIcon size={12} />
                                  <span>{src.title}</span>
                                </Link>
                              );
                            }
                            if (src.type === "user") {
                              return (
                                <Link
                                  key={sIdx}
                                  to={`/profile/${src.id}`}
                                  className="ai-source-chip user"
                                >
                                  <UserIcon size={12} />
                                  <span>{src.title}</span>
                                </Link>
                              );
                            }
                            return (
                              <span key={sIdx} className="ai-source-chip guide">
                                <CheckIcon size={12} />
                                <span>{src.title}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-message-row assistant-row">
                  <div className="ai-message-avatar">
                    <SparklesIcon size={16} />
                  </div>
                  <div className="ai-message-bubble assistant loading-bubble">
                    <div className="ai-typing-indicator">
                      <span className="dot dot-1" />
                      <span className="dot dot-2" />
                      <span className="dot dot-3" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="ai-input-area">
          <div className="ai-input-box">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              placeholder="Ask ANOY AI anything (e.g. 'How do I create a Meeting Room?', 'Find CS communities')..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              disabled={loading}
            />
            <button
              type="button"
              className="ai-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || loading}
              title="Send message"
            >
              {loading ? <LoaderIcon size={16} /> : <SendIcon size={16} />}
            </button>
          </div>
          <div className="ai-input-footer">
            <span>ANOY AI can answer questions about the platform, communities, students, and academic topics.</span>
            <span className="char-counter">{inputValue.length}/1000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
