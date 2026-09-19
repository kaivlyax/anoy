import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoaderIcon } from "./Icons";
import AdminAccessDenied from "./AdminAccessDenied";

function AdminRoute({ children }) {
  const { user, profile, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "grid",
          placeItems: "center",
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

  const role = user?.role || profile?.role || "USER";

  if (role !== "ADMIN") {
    return (
      <AdminAccessDenied
        currentRole={role}
        username={user?.username || "user"}
      />
    );
  }

  return children;
}

export default AdminRoute;
