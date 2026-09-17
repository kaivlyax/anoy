import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { SocketProvider } from "./context/SocketContext";
import Sidebar from "./components/Sidebar";
import RightSidebar from "./components/RightSidebar";
import { MobileNavbar, MobileBottomNav } from "./components/Navbar";
import { LoaderIcon } from "./components/Icons";
import ThemeBackground from "./components/ThemeBackground";

import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import FollowRequests from "./pages/FollowRequests";
import Messages from "./pages/Messages";
import Store from "./pages/Store";
import AnoyAI from "./pages/AnoyAI";
import Communities from "./pages/Communities";
import CommunityDetail from "./pages/CommunityDetail";
import MeetingRoomDetail from "./pages/MeetingRoomDetail";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

import "./App.css";

// Protected Route Guard
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          backgroundColor: "#090d16",
          color: "#4f46e5"
        }}
      >
        <LoaderIcon size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Authenticated Main Layout
function AppLayout() {
  const location = useLocation();
  const isWideLayout =
    location.pathname.startsWith("/messages") ||
    location.pathname.startsWith("/ai") ||
    location.pathname.includes("/meeting-rooms/") ||
    location.pathname.startsWith("/study-rooms");

  return (
    <ThemeBackground>
      <div className="app-container">
        {/* Mobile Top Header */}
        <MobileNavbar />

        <div className={`app-layout ${isWideLayout ? "messages-layout-mode" : ""}`}>
          {/* Left Column: Navigation Sidebar */}
          <Sidebar />

          {/* Center Column: Dynamic Routed View */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/explore" element={<Dashboard />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/follow-requests" element={<FollowRequests />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/ai" element={<AnoyAI />} />
            <Route path="/store" element={<Store />} />
            <Route path="/pro" element={<Store />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/:slug" element={<CommunityDetail />} />
            <Route path="/communities/:slug/meeting-rooms/:roomId" element={<MeetingRoomDetail />} />
            <Route path="/study-rooms" element={<Navigate to="/communities" replace />} />
            <Route path="/study-rooms/:roomId" element={<Navigate to="/communities" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Right Column: Discovery / Recommended Users */}
          {!isWideLayout && <RightSidebar />}
        </div>

        {/* Mobile Bottom Bar */}
        <MobileBottomNav />
      </div>
    </ThemeBackground>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <Routes>
              {/* Public Auth Page */}
              <Route path="/login" element={<Login />} />

              {/* Protected App Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;