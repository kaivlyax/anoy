import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api/v1" : "http://localhost:5001/api/v1");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

// Automatically attach JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unauthenticated sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Grouped API helpers
export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (data) => api.post("/auth/register", data),
  verifyEmail: (data) => api.post("/auth/verify-email", data),
  resendOtp: (data) => api.post("/auth/resend-otp", data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (data) => api.post("/auth/reset-password", data)
};

export const settingsApi = {
  getSettings: () => api.get("/settings"),
  changePassword: (data) => api.post("/settings/change-password", data),
  updatePrivacy: (data) => api.put("/settings/privacy", data),
  updateNotifications: (data) => api.put("/settings/notifications", data),
  getBlockedUsers: () => api.get("/settings/blocked"),
  blockUser: (username) => api.post(`/settings/block/${encodeURIComponent(username)}`),
  unblockUser: (username) => api.post(`/settings/unblock/${encodeURIComponent(username)}`),
  logoutAllDevices: () => api.post("/settings/logout-all"),
  deleteAccount: (data) => api.post("/settings/delete-account", data)
};

export const postApi = {
  getPersonalizedFeed: (page = 1, limit = 10) =>
    api.get(`/posts/feed?page=${page}&limit=${limit}`),
  getExploreFeed: (page = 1, limit = 10) =>
    api.get(`/posts?page=${page}&limit=${limit}`),
  getTrendingTopics: (limit = 5) =>
    api.get(`/posts/trending?limit=${limit}`),
  getPostById: (id) => api.get(`/posts/${id}`),
  createPost: (data) => api.post("/posts", data),
  updatePost: (id, data) => api.patch(`/posts/${id}`, data),
  deletePost: (id) => api.delete(`/posts/${id}`)
};

export const likeApi = {
  likePost: (postId) => api.post(`/posts/${postId}/like`),
  unlikePost: (postId) => api.delete(`/posts/${postId}/like`)
};

export const commentApi = {
  getComments: (postId) => api.get(`/posts/${postId}/comments`),
  createComment: (postId, data) => api.post(`/posts/${postId}/comments`, data),
  updateComment: (commentId, data) => api.patch(`/posts/comments/${commentId}`, data),
  deleteComment: (commentId) => api.delete(`/posts/comments/${commentId}`)
};

export const profileApi = {
  getMyProfile: () => api.get("/profile/me"),
  updateMyProfile: (data) => api.put("/profile/me", data),
  createProfile: (data) => api.post("/profile", data),
  getProfile: (username) => api.get(`/profile/${username}`),
  getProfileStats: (username) => api.get(`/profile/${username}/stats`)
};

export const followApi = {
  getFollowStatus: (username) => api.get(`/follow/${username}/status`),
  followUser: (username) => api.post(`/follow/${username}`),
  unfollowUser: (username) => api.delete(`/follow/${username}`),
  getFollowers: (username) => api.get(`/follow/${username}/followers`),
  getFollowing: (username) => api.get(`/follow/${username}/following`),
  getFollowRequests: () => api.get("/follow/requests"),
  acceptFollowRequest: (username) => api.post(`/follow/requests/${username}/accept`),
  rejectFollowRequest: (username) => api.post(`/follow/requests/${username}/reject`)
};

export const notificationApi = {
  getNotifications: (page = 1, limit = 20) =>
    api.get(`/notifications?page=${page}&limit=${limit}`),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/notifications/read-all"),
  deleteNotification: (id) => api.delete(`/notifications/${id}`)
};

export const userApi = {
  searchUsers: (query) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  discoverUsers: (limit = 10) => api.get(`/users/discover?limit=${limit}`)
};

export const mediaApi = {
  uploadImage: (formData) =>
    api.post("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
};

export const conversationApi = {
  getConversations: () => api.get("/conversations"),
  getOrCreateConversation: (data) => api.post("/conversations", data),
  getMessages: (conversationId, page = 1, limit = 30) =>
    api.get(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (conversationId, data) =>
    api.post(`/conversations/${conversationId}/messages`, data),
  deleteMessage: (conversationId, messageId) =>
    api.delete(`/conversations/${conversationId}/messages/${messageId}`),
  getUnreadCount: () => api.get("/conversations/unread-count")
};

export const premiumApi = {
  getCatalog: () => api.get("/premium/catalog"),
  getInventory: () => api.get("/premium/inventory"),
  getStatus: () => api.get("/premium/status"),
  checkoutMock: (itemId) => api.post("/premium/checkout-mock", { itemId }),
  activateCustomization: (type, itemId) => api.post("/premium/activate", { type, itemId }),
  deactivateCustomization: (type) => api.post("/premium/deactivate", { type })
};

export const paymentApi = {
  createOrder: (plan) => api.post("/payments/create-order", { plan }),
  verifyPayment: (data) => api.post("/payments/verify", data),
  getPaymentHistory: () => api.get("/payments/history")
};

export const aiApi = {
  chat: (data) => api.post("/ai/chat", data),
  getConversations: () => api.get("/ai/conversations"),
  getMessages: (conversationId) => api.get(`/ai/conversations/${conversationId}/messages`),
  deleteConversation: (conversationId) => api.delete(`/ai/conversations/${conversationId}`)
};



export const communityApi = {
  getCommunities: (params = {}) => api.get("/communities", { params }),
  getCommunity: (slugOrId) => api.get(`/communities/${slugOrId}`),
  createCommunity: (data) => api.post("/communities", data),
  updateCommunity: (id, data) => api.put(`/communities/${id}`, data),
  joinCommunity: (id) => api.post(`/communities/${id}/join`),
  leaveCommunity: (id) => api.post(`/communities/${id}/leave`),
  getMembers: (id, params = {}) => api.get(`/communities/${id}/members`, { params }),
  addModerator: (id, targetUserId, reason = "") => api.post(`/communities/${id}/moderators`, { targetUserId, reason }),
  removeModerator: (id, targetUserId) => api.delete(`/communities/${id}/moderators/${targetUserId}`),
  removeMember: (id, targetUserId, reason = "") => api.delete(`/communities/${id}/members/${targetUserId}`, { data: { reason } }),
  banMember: (id, targetUserId, reason = "") => api.post(`/communities/${id}/members/${targetUserId}/ban`, { reason }),
  unbanMember: (id, targetUserId) => api.post(`/communities/${id}/members/${targetUserId}/unban`),
  getBannedMembers: (id) => api.get(`/communities/${id}/banned`),
  getModerationLogs: (id) => api.get(`/communities/${id}/moderation-logs`),
  createReport: (id, data) => api.post(`/communities/${id}/reports`, data),
  getReports: (id, params = {}) => api.get(`/communities/${id}/reports`, { params }),
  resolveReport: (id, reportId, data) => api.put(`/communities/${id}/reports/${reportId}`, data),
  boostCommunity: (id) => api.post(`/communities/${id}/boost`),
  getBoosters: (id) => api.get(`/communities/${id}/boosters`),
  updateDecorations: (id, data) => api.put(`/communities/${id}/decorations`, data),
  unlockDecoration: (id, decorationId) => api.post(`/communities/${id}/decorations/unlock`, { decorationId })
};

export const communityChatApi = {
  getMessages: (communityId, channel = "general", page = 1, limit = 50) =>
    api.get(`/communities/${communityId}/messages?channel=${encodeURIComponent(channel)}&page=${page}&limit=${limit}`),
  sendMessage: (communityId, data) =>
    api.post(`/communities/${communityId}/messages`, data),
  deleteMessage: (communityId, messageId) =>
    api.delete(`/communities/${communityId}/messages/${messageId}`)
};

export const meetingRoomApi = {
  getCommunityRooms: (communityId, params = {}) =>
    api.get(`/communities/${communityId}/meeting-rooms`, { params }),
  createRoom: (communityId, data) =>
    api.post(`/communities/${communityId}/meeting-rooms`, data),
  getRoom: (id) => api.get(`/meeting-rooms/${id}`),
  joinRoom: (id, passcode = "") => api.post(`/meeting-rooms/${id}/join`, { passcode }),
  leaveRoom: (id) => api.post(`/meeting-rooms/${id}/leave`),
  deleteRoom: (id) => api.delete(`/meeting-rooms/${id}`)
};

export const studyRoomApi = meetingRoomApi;

export const searchApi = {
  search: (q, type = "all", limit = 20) =>
    api.get(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`),
  searchUsers: (q, limit = 20) =>
    api.get(`/search/users?q=${encodeURIComponent(q)}&limit=${limit}`),
  searchCommunities: (q, limit = 20) =>
    api.get(`/search/communities?q=${encodeURIComponent(q)}&limit=${limit}`),
  searchPosts: (q, limit = 20) =>
    api.get(`/search/posts?q=${encodeURIComponent(q)}&limit=${limit}`)
};

export default api;
