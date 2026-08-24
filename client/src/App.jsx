import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Sidebar from "./components/Sidebar";
import RightSidebar from "./components/RightSidebar";
import { MobileNavbar, MobileBottomNav } from "./components/Navbar";
import { LoaderIcon } from "./components/Icons";

import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import FollowRequests from "./pages/FollowRequests";
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
          backgroundColor: "var(--bg-app)",
          color: "var(--primary)"
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
  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <MobileNavbar />

      <div className="app-layout">
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Right Column: Discovery / Recommended Users */}
        <RightSidebar />
      </div>

      {/* Mobile Bottom Bar */}
      <MobileBottomNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;