import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, profileApi, notificationApi } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch full user profile
  const fetchProfile = useCallback(async () => {
    if (!token) return null;
    try {
      const response = await profileApi.getMyProfile();
      if (response.data.success && response.data.profile) {
        setProfile(response.data.profile);
        return response.data.profile;
      }
    } catch (err) {
      console.warn("Could not fetch my profile:", err?.response?.data?.message || err.message);
      // Profile might not be created yet if new user
      if (err?.response?.status === 404 && user?.username) {
        try {
          const createRes = await profileApi.createProfile({
            displayName: user.username,
            bio: "",
            privacy: "PUBLIC"
          });
          if (createRes.data.success) {
            setProfile(createRes.data.profile);
            return createRes.data.profile;
          }
        } catch {
          // ignore
        }
      }
    }
    return null;
  }, [token, user?.username]);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await notificationApi.getUnreadCount();
      if (response.data.success) {
        setUnreadCount(response.data.count || 0);
      }
    } catch {
      // ignore
    }
  }, [token]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      if (token) {
        await fetchProfile();
        await fetchUnreadCount();
      }
      if (isMounted) setLoading(false);
    };
    initAuth();
    return () => {
      isMounted = false;
    };
  }, [token, fetchProfile, fetchUnreadCount]);

  // Login handler
  const login = async (identifier, password) => {
    try {
      const response = await authApi.login({ identifier, password });
      const { token: jwtToken, user: userData } = response.data;

      localStorage.setItem("token", jwtToken);
      localStorage.setItem("user", JSON.stringify(userData));

      setToken(jwtToken);
      setUser(userData);

      try {
        const profRes = await profileApi.getMyProfile();
        if (profRes.data.profile) {
          setProfile(profRes.data.profile);
        }
      } catch {
        try {
          const createRes = await profileApi.createProfile({
            displayName: userData.username,
            bio: "",
            privacy: "PUBLIC"
          });
          if (createRes.data.profile) {
            setProfile(createRes.data.profile);
          }
        } catch {
          // ignore
        }
      }

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.message || "Login failed. Please check your credentials.";
      return { success: false, error: message };
    }
  };

  // Register handler
  const register = async (email, username, password) => {
    try {
      const response = await authApi.register({ email, username, password });
      return {
        success: true,
        message: response.data.message || "Registration successful! Please verify OTP.",
        userId: response.data.userId
      };
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed.";
      return { success: false, error: message };
    }
  };

  // Verify Email OTP handler
  const verifyEmail = async (email, otp) => {
    try {
      const response = await authApi.verifyEmail({ email, otp });
      return {
        success: true,
        message: response.data.message || "Email verified successfully!"
      };
    } catch (err) {
      const message = err.response?.data?.message || "Email verification failed.";
      return { success: false, error: message };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setProfile(null);
    setUnreadCount(0);
  };

  const refreshProfile = async () => {
    return await fetchProfile();
  };

  const decrementUnreadCount = (amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  };

  const resetUnreadCount = () => {
    setUnreadCount(0);
  };

  const value = {
    token,
    user,
    profile,
    loading,
    isAuthenticated: Boolean(token),
    unreadCount,
    login,
    register,
    verifyEmail,
    logout,
    refreshProfile,
    fetchUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
    setProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
