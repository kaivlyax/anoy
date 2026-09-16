import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { conversationApi } from "../services/api";

const SocketContext = createContext(null);

const SOCKET_SERVER_URL = "http://localhost:5001";

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const socketRef = useRef(null);

  // Fetch global unread message count
  const fetchUnreadMessagesCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await conversationApi.getUnreadCount();
      if (response.data.success) {
        setUnreadMessagesCount(response.data.count || 0);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const decrementUnreadMessagesCount = useCallback((amount = 1) => {
    setUnreadMessagesCount((prev) => Math.max(0, prev - amount));
  }, []);

  // Manage socket connection lifecycle
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers(new Set());
        setUnreadMessagesCount(0);
      }
      return;
    }

    // Initial fetch of unread messages count
    fetchUnreadMessagesCount();

    const socketInstance = io(SOCKET_SERVER_URL, {
      auth: {
        token
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
      setIsConnected(false);
    });

    // Receive initial online users list
    socketInstance.on("users:online", (userIds) => {
      if (Array.isArray(userIds)) {
        setOnlineUsers(new Set(userIds));
      }
    });

    // Real-time status update for individual user
    socketInstance.on("user:status", ({ userId, status }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === "online") {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    // Update unread count when conversations update
    socketInstance.on("conversation:updated", (data) => {
      if (data?.incrementUnread) {
        setUnreadMessagesCount((prev) => prev + 1);
      }
    });

    socketInstance.on("unread:updated", () => {
      fetchUnreadMessagesCount();
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token, fetchUnreadMessagesCount]);

  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineUsers.has(userId.toString());
    },
    [onlineUsers]
  );

  const value = {
    socket,
    isConnected,
    onlineUsers,
    isUserOnline,
    unreadMessagesCount,
    fetchUnreadMessagesCount,
    decrementUnreadMessagesCount
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
