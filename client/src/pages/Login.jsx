import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LoaderIcon, AlertCircleIcon, CheckIcon } from "../components/Icons";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, verifyEmail, resendOTP } = useAuth();
  const { addToast } = useToast();

  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'verify'

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const from = location.state?.from?.pathname || "/";

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    const result = await login(identifier, password);
    setLoading(false);

    if (result.success) {
      addToast("Welcome back!", "success");
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      if (result.error.toLowerCase().includes("verify your email")) {
        setEmail(identifier);
        setMode("verify");
        setResendCooldown(60);
      }
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    const result = await register(email, username, password);
    setLoading(false);

    if (result.success) {
      addToast("Account created! A verification code was sent to your email.", "success");
      setInfoMessage(`We sent a 6-digit verification code to ${email}`);
      setResendCooldown(60);
      setMode("verify");
    } else {
      setError(result.error);
    }
  };

  // Handle OTP Verification Submit
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    const result = await verifyEmail(email, otp.trim());
    setLoading(false);

    if (result.success) {
      addToast("Email verified successfully!", "success");
      if (password) {
        setLoading(true);
        const logRes = await login(username || email, password);
        setLoading(false);
        if (logRes.success) {
          navigate(from, { replace: true });
          return;
        }
      }
      setMode("login");
      setIdentifier(username || email);
      setInfoMessage("Email verified! You can now sign in with your credentials.");
    } else {
      setError(result.error);
    }
  };

  // Handle Resend OTP Click
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading || !email.trim()) return;

    setError("");
    setResendLoading(true);

    const result = await resendOTP(email.trim());
    setResendLoading(false);

    if (result.success) {
      addToast("Verification code resent! Please check your inbox.", "success");
      setInfoMessage(`A fresh 6-digit code has been sent to ${email}`);
      setResendCooldown(60);
      setOtp("");
    } else {
      setError(result.error);
      if (result.retryAfter) {
        setResendCooldown(result.retryAfter);
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">A</div>
          <h1 className="auth-title">
            {mode === "login" && "Welcome to ANOY"}
            {mode === "register" && "Join the Network"}
            {mode === "verify" && "Verify Your Email"}
          </h1>
          <p className="auth-subtitle">
            {mode === "login" && "Sign in to access your personalized feed"}
            {mode === "register" && "Create an account to connect with creators"}
            {mode === "verify" && `Enter the 6-digit verification code sent to your email`}
          </p>
        </div>

        {/* Tab Switcher (Login / Register) */}
        {mode !== "verify" && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
                setInfoMessage("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => {
                setMode("register");
                setError("");
                setInfoMessage("");
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error / Info Banners */}
        {error && (
          <div className="auth-error-banner" style={{ marginBottom: 16 }}>
            <AlertCircleIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="auth-success-banner" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckIcon size={18} />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="identifier">Username or Email</label>
              <input
                id="identifier"
                type="text"
                placeholder="e.g. alex or alex@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !identifier.trim() || !password}
            >
              {loading ? <LoaderIcon size={18} /> : "Sign In"}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reg-email">Email address</label>
              <input
                id="reg-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="^[a-zA-Z0-9_.-]+$"
                title="Letters, numbers, underscores, dashes only"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password (min 8 characters)</label>
              <input
                id="reg-password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !email.trim() || !username.trim() || password.length < 8}
            >
              {loading ? <LoaderIcon size={18} /> : "Continue to Verification"}
            </button>
          </form>
        )}

        {/* OTP VERIFICATION FORM */}
        {mode === "verify" && (
          <form onSubmit={handleVerifyOtpSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="verify-email">Email</label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label htmlFor="otp-code" style={{ margin: 0 }}>6-Digit Verification Code</label>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Expires in 10 mins</span>
              </div>
              <div className="otp-box-container">
                <input
                  id="otp-code"
                  type="text"
                  className="otp-input"
                  placeholder="------"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || otp.trim().length !== 6}
            >
              {loading ? <LoaderIcon size={18} /> : "Verify & Complete"}
            </button>

            {/* Resend OTP Button & Cooldown */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resendLoading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: resendCooldown > 0 ? "var(--text-dim)" : "var(--accent)",
                  fontSize: 13,
                  cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: 0
                }}
              >
                {resendLoading && <LoaderIcon size={14} />}
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend OTP"}
              </button>

              <button
                type="button"
                style={{ color: "var(--text-dim)", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => {
                  setMode("login");
                  setError("");
                  setInfoMessage("");
                }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;