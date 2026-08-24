import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { followApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import { UsersIcon, CheckIcon, XIcon, LoaderIcon, AlertCircleIcon } from "../components/Icons";

function FollowRequests() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState({});

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await followApi.getFollowRequests();
      if (response.data.success) {
        setRequests(response.data.requests || []);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Failed to load follow requests"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAccept = async (username) => {
    try {
      setProcessing((prev) => ({ ...prev, [username]: "accepting" }));
      const response = await followApi.acceptFollowRequest(username);
      if (response.data.success) {
        setRequests((prev) =>
          prev.filter((r) => r.follower?.username !== username)
        );
        addToast(`Accepted follow request from @${username}`, "success");
      }
    } catch (err) {
      addToast(
        err.response?.data?.message || "Failed to accept request",
        "error"
      );
    } finally {
      setProcessing((prev) => ({ ...prev, [username]: null }));
    }
  };

  const handleReject = async (username) => {
    try {
      setProcessing((prev) => ({ ...prev, [username]: "rejecting" }));
      const response = await followApi.rejectFollowRequest(username);
      if (response.data.success) {
        setRequests((prev) =>
          prev.filter((r) => r.follower?.username !== username)
        );
        addToast(`Rejected follow request from @${username}`, "info");
      }
    } catch (err) {
      addToast(
        err.response?.data?.message || "Failed to reject request",
        "error"
      );
    } finally {
      setProcessing((prev) => ({ ...prev, [username]: null }));
    }
  };

  return (
    <div className="main-feed-column">
      <header className="sticky-header">
        <h2 className="sticky-header-title">Follow Requests</h2>
      </header>

      <main>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="widget-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  marginBottom: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    className="skeleton-box"
                    style={{ width: 44, height: 44, borderRadius: "50%" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="skeleton-box" style={{ width: 120, height: 14 }} />
                    <div className="skeleton-box" style={{ width: 160, height: 11 }} />
                  </div>
                </div>
                <div className="skeleton-box" style={{ width: 140, height: 32, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-feed">
            <div className="empty-feed-icon" style={{ color: "#ef4444" }}>
              <AlertCircleIcon size={30} />
            </div>
            <h3 className="empty-feed-title">Error</h3>
            <p className="empty-feed-subtitle">{error}</p>
            <button
              className="composer-submit-btn"
              style={{ marginTop: 8 }}
              onClick={fetchRequests}
            >
              Try Again
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-icon">
              <UsersIcon size={30} />
            </div>
            <h3 className="empty-feed-title">No pending follow requests</h3>
            <p className="empty-feed-subtitle">
              When someone requests to follow your private account, their request will appear here.
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px 20px" }}>
            <div className="discover-user-list">
              {requests.map((req) => {
                const requester = req.follower;
                if (!requester) return null;
                const isBusy = Boolean(processing[requester.username]);

                return (
                  <div
                    key={req._id}
                    className="widget-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px"
                    }}
                  >
                    <Link
                      to={`/profile/${requester.username}`}
                      className="discover-user-info"
                      aria-label={`View @${requester.username}'s profile`}
                    >
                      <div
                        className="discover-user-avatar"
                        style={{ width: 44, height: 44, fontSize: 16 }}
                      >
                        {requester.avatar ? (
                          <img
                            src={requester.avatar}
                            alt={requester.username}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              objectFit: "cover"
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          requester.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="discover-user-names">
                        <span
                          className="discover-name"
                          style={{ fontSize: 15 }}
                        >
                          @{requester.username}
                        </span>
                        <span className="discover-handle">
                          {requester.email}
                        </span>
                      </div>
                    </Link>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="composer-submit-btn"
                        style={{
                          padding: "6px 14px",
                          fontSize: 13,
                          background: "#10b981"
                        }}
                        disabled={isBusy}
                        onClick={() => handleAccept(requester.username)}
                        aria-label={`Accept follow request from @${requester.username}`}
                      >
                        {processing[requester.username] === "accepting" ? (
                          <LoaderIcon size={14} />
                        ) : (
                          <>
                            <CheckIcon size={14} />
                            <span>Accept</span>
                          </>
                        )}
                      </button>

                      <button
                        className="composer-submit-btn"
                        style={{
                          padding: "6px 14px",
                          fontSize: 13,
                          background: "var(--bg-surface)",
                          color: "var(--text-main)",
                          border: "1px solid var(--border-light)"
                        }}
                        disabled={isBusy}
                        onClick={() => handleReject(requester.username)}
                        aria-label={`Reject follow request from @${requester.username}`}
                      >
                        {processing[requester.username] === "rejecting" ? (
                          <LoaderIcon size={14} />
                        ) : (
                          <>
                            <XIcon size={14} />
                            <span>Reject</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default FollowRequests;
