import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../services/api";
import { LoaderIcon, AlertCircleIcon, CheckIcon } from "../components/Icons";
import AnoyLogo from "../components/AnoyLogo";
import ThemeBackground from "../components/ThemeBackground";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, verifyEmail, resendOTP } = useAuth();
  const { addToast } = useToast();

  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'verify' | 'forgot' | 'reset'

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
      addToast("Welcome back to ANOY!", "success");
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      if (result.error && result.error.toLowerCase().includes("verify your email")) {
        const targetEmail = result.email || (identifier.includes("@") ? identifier.trim() : "");
        if (targetEmail) {
          setEmail(targetEmail);
        }
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

  // Handle Forgot Password (Step 1) Submit
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setError("Please enter your registered email address");
      return;
    }
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      const res = await authApi.forgotPassword({ email: emailToUse });
      setLoading(false);
      if (res.data.success) {
        addToast("Password reset code sent to your email", "info");
        setInfoMessage(res.data.message || `If an account with this email exists, a 6-digit code has been sent.`);
        setResendCooldown(60);
        setOtp("");
        setNewPassword("");
        setMode("reset");
      }
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || "Failed to send reset code. Please try again.";
      setError(msg);
      if (err.response?.data?.retryAfter) {
        setResendCooldown(err.response.data.retryAfter);
      }
    }
  };

  // Handle Reset Password (Step 2) Submit
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setError("Email address is required");
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      const res = await authApi.resetPassword({
        email: emailToUse,
        otp: otp.trim(),
        newPassword
      });
      setLoading(false);
      if (res.data.success) {
        addToast("Password reset successfully! Please sign in with your new password.", "success");
        setInfoMessage("Password reset successfully. You can now sign in with your new password.");
        setIdentifier(emailToUse);
        setPassword("");
        setOtp("");
        setNewPassword("");
        setMode("login");
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || "Invalid or expired reset code. Please try again.");
    }
  };

  // Handle Resend Reset OTP
  const handleResendResetOtp = async () => {
    const emailToUse = email.trim().toLowerCase();
    if (resendCooldown > 0 || resendLoading || !emailToUse) return;

    setError("");
    setResendLoading(true);

    try {
      const res = await authApi.forgotPassword({ email: emailToUse });
      setResendLoading(false);
      if (res.data.success) {
        addToast("Verification code resent! Please check your inbox.", "success");
        setInfoMessage(res.data.message || `A fresh 6-digit code has been sent to ${emailToUse}`);
        setResendCooldown(60);
        setOtp("");
      }
    } catch (err) {
      setResendLoading(false);
      setError(err.response?.data?.message || "Failed to resend reset code");
      if (err.response?.data?.retryAfter) {
        setResendCooldown(err.response.data.retryAfter);
      }
    }
  };

  return (
    <div className="anoy-app-shell">
      <ThemeBackground />
      <div className="anoy-app-content">
        <div className="auth-page">
          <div className="auth-card">
            {/* Brand Header with ANOY Logo & Subtitle */}
            <div className="auth-header">
              <AnoyLogo
                variant="login"
                showTagline={true}
                showSubtext={true}
                clickable={false}
              />
              <h1 className="auth-title" style={{ marginTop: 12 }}>
                {mode === "login" && "Welcome to ANOY"}
                {mode === "register" && "Join the Network"}
                {mode === "verify" && "Verify Your Email"}
                {mode === "forgot" && "Reset Password"}
                {mode === "reset" && "Set New Password"}
              </h1>
              <p className="auth-subtitle">
                {mode === "login" && "Sign in to access your personalized feed"}
                {mode === "register" && "Create an account to connect with creators"}
                {mode === "verify" && `Enter the 6-digit OTP sent to ${email}`}
                {mode === "forgot" && "Enter your email to receive a 6-digit password reset code"}
                {mode === "reset" && `Enter the 6-digit code sent to ${email} and your new password`}
              </p>
            </div>

            {/* Tab Switcher (Login / Register) */}
            {(mode === "login" || mode === "register") && (
              <div className="auth-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
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
                  role="tab"
                  aria-selected={mode === "register"}
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
              <div className="auth-error-banner" style={{ marginBottom: 16 }} role="alert">
                <AlertCircleIcon size={18} />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="auth-success-banner" style={{ marginBottom: 16 }} role="status">
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
                    autoComplete="username"
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label htmlFor="password" style={{ margin: 0 }}>Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setInfoMessage("");
                        if (identifier && identifier.includes("@")) {
                          setEmail(identifier.trim().toLowerCase());
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--primary)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0
                      }}
                      aria-label="Forgot password?"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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

            {/* FORGOT PASSWORD FORM (STEP 1) */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="forgot-email">Registered Email address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || !email.trim()}
                >
                  {loading ? <LoaderIcon size={18} /> : "Send Reset Code"}
                </button>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                  <button
                    type="button"
                    style={{ color: "var(--text-dim)", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px" }}
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

            {/* RESET PASSWORD FORM (STEP 2) */}
            {mode === "reset" && (
              <form onSubmit={handleResetSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label htmlFor="reset-otp-code" style={{ margin: 0 }}>6-Digit Reset Code</label>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Expires in 10 mins</span>
                  </div>
                  <div className="otp-box-container">
                    <input
                      id="reset-otp-code"
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

                <div className="form-group">
                  <label htmlFor="reset-new-password">New Password (min 8 characters)</label>
                  <input
                    id="reset-new-password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || otp.trim().length !== 6 || newPassword.length < 8}
                >
                  {loading ? <LoaderIcon size={18} /> : "Reset Password & Sign In"}
                </button>

                {/* Resend Code & Back to Sign In */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-color)" }}>
                  <button
                    type="button"
                    onClick={handleResendResetOtp}
                    disabled={resendCooldown > 0 || resendLoading}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: resendCooldown > 0 ? "var(--text-dim)" : "var(--primary)",
                      fontSize: 13,
                      cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 0
                    }}
                  >
                    {resendLoading && <LoaderIcon size={14} />}
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend reset code"}
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
                    autoComplete="email"
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
                    autoComplete="username"
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
                    autoComplete="new-password"
                  />
                </div>

                <p className="auth-legal-consent">
                  By registering, you agree to our{" "}
                  <Link to="/terms" className="auth-legal-link" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="auth-legal-link" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </Link>.
                </p>

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
                      color: resendCooldown > 0 ? "var(--text-dim)" : "var(--primary)",
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

            {/* Bottom Card Footer with Bharat Pride Badge & Legal Links */}
            <div className="auth-footer-links">
              <div className="auth-footer-legal-row">
                <Link to="/privacy" className="auth-footer-legal-link">Privacy Policy</Link>
                <span>&bull;</span>
                <Link to="/terms" className="auth-footer-legal-link">Terms of Service</Link>
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>🇮🇳</span> Built for Bharat, By Students
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
