import axios from "axios";

const API_BASE_URL = "http://localhost:5001/api/v1";

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
      // Clear expired token if unauthorized
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
  verifyEmail: (data) => api.post("/auth/verify-email", data)
};

export const postApi = {
  getPersonalizedFeed: (page = 1, limit = 10) =>
    api.get(`/posts/feed?page=${page}&limit=${limit}`),
  getExploreFeed: (page = 1, limit = 10) =>
    api.get(`/posts?page=${page}&limit=${limit}`),
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

export default api;