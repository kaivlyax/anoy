import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LoaderIcon, AlertCircleIcon, CheckIcon } from "../components/Icons";
import AnoyLogo from "../components/AnoyLogo";
import ThemeBackground from "../components/ThemeBackground";

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
      addToast("Welcome back to ANOY!", "success");
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      if (result.error && result.error.toLowerCase().includes("verify your email")) {
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
    <ThemeBackground>
      <div className="auth-page-wrapper">
        {/* Floating Handwritten Notes (Reference 1) */}
        <div className="handwritten-note note-top-left" aria-hidden="true">
          <span>Students</span>
          <span className="note-accent">Communities</span>
          <span>Ideas</span>
          <span className="note-bharat">India ♡</span>
        </div>

        <div className="handwritten-note note-top-right" aria-hidden="true">
          <span>Apna social space for</span>
          <span className="note-accent">universities & creators ✨</span>
        </div>

        <div className="handwritten-note note-bottom-left" aria-hidden="true">
          <span>Made with pride for</span>
          <span className="note-bharat">Bharat 🇮🇳</span>
        </div>

        {/* Central Glassmorphism Auth Card */}
        <div className="auth-card-modern glass-panel-glow">
          {/* Brand Header with ANOY Logo & Tagline */}
          <div className="auth-brand-header">
            <AnoyLogo
              variant="login"
              showTagline={true}
              showSubtext={true}
              clickable={false}
            />
          </div>

          {/* Dual Pill Tab Selector (Sign In / Create Account) */}
          {mode !== "verify" && (
            <div className="auth-pill-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`auth-pill-tab ${mode === "login" ? "active" : ""}`}
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
                className={`auth-pill-tab ${mode === "register" ? "active" : ""}`}
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
            <div className="auth-error-banner" role="alert">
              <AlertCircleIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="auth-success-banner" role="status">
              <CheckIcon size={18} />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="auth-modern-form">
              <div className="form-group-modern">
                <label htmlFor="identifier">Username or Email</label>
                <input
                  id="identifier"
                  type="text"
                  placeholder="e.g. aryan or aryan@university.edu"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="form-group-modern">
                <div className="form-label-row">
                  <label htmlFor="password">Password</label>
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
                className="auth-primary-btn glow-button"
                disabled={loading || !identifier.trim() || !password}
              >
                {loading ? <LoaderIcon size={20} /> : "Sign In to ANOY"}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegisterSubmit} className="auth-modern-form">
              <div className="form-group-modern">
                <label htmlFor="reg-email">Email address</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@university.edu or you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div className="form-group-modern">
                <label htmlFor="reg-username">Username</label>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="Choose a unique username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  pattern="^[a-zA-Z0-9_.-]+$"
                  title="Letters, numbers, underscores, dashes only"
                  autoComplete="username"
                />
              </div>

              <div className="form-group-modern">
                <label htmlFor="reg-password">Password (min 8 characters)</label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="auth-primary-btn glow-button"
                disabled={loading || !email.trim() || !username.trim() || password.length < 8}
              >
                {loading ? <LoaderIcon size={20} /> : "Continue to Verification"}
              </button>
            </form>
          )}

          {/* OTP VERIFICATION FORM */}
          {mode === "verify" && (
            <form onSubmit={handleVerifyOtpSubmit} className="auth-modern-form">
              <div className="form-group-modern">
                <label htmlFor="verify-email">Verification Email</label>
                <input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-modern">
                <div className="form-label-row">
                  <label htmlFor="otp-code">6-Digit Verification Code</label>
                  <span className="otp-expiry-hint">Expires in 10 mins</span>
                </div>
                <div className="otp-input-wrapper">
                  <input
                    id="otp-code"
                    type="text"
                    className="otp-code-input"
                    placeholder="• • • • • •"
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
                className="auth-primary-btn glow-button"
                disabled={loading || otp.trim().length !== 6}
              >
                {loading ? <LoaderIcon size={20} /> : "Verify & Complete Sign In"}
              </button>

              {/* Resend OTP & Back Action */}
              <div className="otp-resend-row">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resendLoading}
                  className="otp-resend-btn"
                >
                  {resendLoading && <LoaderIcon size={14} />}
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive code? Resend OTP"}
                </button>

                <button
                  type="button"
                  className="otp-back-btn"
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

          {/* Bottom Card Footer with Bharat Pride Badge */}
          <div className="auth-card-footer">
            <span className="auth-bharat-badge">
              🇮🇳 Built for Bharat, By Students
            </span>
          </div>
        </div>
      </div>
    </ThemeBackground>
  );
}

export default Login;