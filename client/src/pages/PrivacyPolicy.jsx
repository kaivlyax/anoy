import { Link } from "react-router-dom";
import AnoyLogo from "../components/AnoyLogo";
import { ShieldIcon, ArrowLeftIcon, LockIcon, AlertCircleIcon } from "../components/Icons";

function PrivacyPolicy() {
  return (
    <div className="legal-page-container">
      <div className="legal-page-wrapper glass-panel">
        {/* Header navigation */}
        <header className="legal-header">
          <div className="legal-header-brand">
            <Link to="/" className="legal-brand-link">
              <AnoyLogo size={32} />
              <span className="legal-brand-text">ANOY</span>
            </Link>
          </div>
          <Link to="/" className="legal-back-btn">
            <ArrowLeftIcon size={16} />
            <span>Back to ANOY</span>
          </Link>
        </header>

        {/* Legal notice banner */}
        <div className="legal-campus-notice">
          <AlertCircleIcon size={20} className="notice-icon" />
          <div>
            <strong>Campus Pilot Notice & Legal Review Disclosure</strong>
            <p>
              ANOY is currently operating under pilot campus deployment. These policies represent our current technical practices and operational standards and will undergo institutional legal and compliance review in coordination with university administration prior to formal institution-wide release.
            </p>
          </div>
        </div>

        <main className="legal-content">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-effective-date">Last Updated: September 2026</p>

          <section className="legal-section">
            <h2>1. Introduction & Mission</h2>
            <p>
              Welcome to ANOY (&ldquo;Apna Social Space&rdquo;). We are committed to fostering an authentic, vibrant, and safe digital campus community. This Privacy Policy details how we collect, store, utilize, and protect your information when you access our platform, mobile interfaces, and real-time community spaces.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>
            <p>We collect information to provide, maintain, and secure our social services:</p>
            <ul>
              <li>
                <strong>Account & Identity Data:</strong> When registering, you provide your email address, username, and password. Passwords are cryptographically salted and hashed using industry-standard bcrypt prior to storage; plaintext passwords are never stored or accessible by ANOY personnel.
              </li>
              <li>
                <strong>Profile & Personalization:</strong> Display names, profile bios, avatar image URLs, cover images, skill tags, interest tags, and profile theme customizations.
              </li>
              <li>
                <strong>User Content:</strong> Public and follower-only posts, comments, media uploads (images and videos), reaction interactions, and community messages.
              </li>
              <li>
                <strong>Direct Communications:</strong> 1-to-1 private messages and media attachments sent between users.
              </li>
              <li>
                <strong>Technical & Security Telemetry:</strong> Log data, IP addresses, browser user agents, session tokens, and security event timestamps required to detect abuse, spam, and unauthorized platform access.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Private Messaging Architecture & Administrative Safety Review</h2>
            <div className="legal-highlight-box">
              <div className="highlight-icon-row">
                <LockIcon size={20} />
                <strong>Transparent Direct Messaging Disclosure</strong>
              </div>
              <p>
                Private direct messages on ANOY are encrypted in transit using Transport Layer Security (TLS 1.3 / HTTPS / WSS) and stored securely in platform databases.
              </p>
              <p>
                <strong>ANOY does NOT use End-to-End Encryption (E2EE).</strong> Private communications are stored in server-readable format to enable authorized platform safety administrators to conduct targeted, audited reviews when necessary.
              </p>
              <p>
                <strong>Strict Governance & Immutable Auditing:</strong> Private message reviews are strictly limited to designated platform administrators and cannot be accessed by general moderators, community owners, support staff, or standard users. Review actions require a mandatory documented safety, fraud, harassment, or legal justification, and every access event is permanently recorded in our immutable platform audit logs.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. How We Use Information</h2>
            <p>We use collected data solely for platform operations, including:</p>
            <ul>
              <li>Delivering personalized feeds, explore discovery, and community interactions.</li>
              <li>Facilitating real-time audio/video study spaces and community chat channels.</li>
              <li>Enforcing safety guidelines, detecting spam, preventing harassment, and managing account restrictions or bans.</li>
              <li>Authenticating user sessions and sending critical account security alerts (such as OTP verification and password resets).</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Data Security & Storage</h2>
            <p>
              We implement comprehensive technical and organizational safeguards designed to protect personal data against unauthorized disclosure, alteration, or destruction:
            </p>
            <ul>
              <li>All web traffic and real-time Socket.IO communication utilize modern TLS/SSL encryption.</li>
              <li>Strict role-based access control (RBAC) isolates platform administrative controls from standard user permissions.</li>
              <li>Token versioning immediately invalidates active sessions upon security events, password changes, or account restrictions.</li>
            </ul>
            <p className="legal-disclaimer-note">
              <em>Security Notice:</em> While we implement rigorous industry safeguards, no digital platform or internet transmission can be certified as 100% immune from unauthorized access or hardware vulnerabilities. We encourage users to maintain strong unique passwords and report suspected security anomalies immediately.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. User Rights & Data Control</h2>
            <p>You have direct control over your personal data on ANOY:</p>
            <ul>
              <li><strong>Profile Privacy:</strong> You can toggle your profile between Public and Private status in Settings.</li>
              <li><strong>Blocked Users:</strong> You can block disruptive accounts to prevent unwanted interactions.</li>
              <li><strong>Account Deletion:</strong> You can delete your account at any time via Settings. Permanent deletion removes your identity credentials, profile details, and authored posts from active platform feeds.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>7. Contact & Campus Inquiries</h2>
            <p>
              For privacy-related inquiries, data requests, or campus safety feedback, please contact the platform administration team at <a href="mailto:support@anoyy.tech" className="legal-email-link">support@anoyy.tech</a>.
            </p>
          </section>
        </main>

        <footer className="legal-footer">
          <p>&copy; {new Date().getFullYear()} ANOY. Built for Campus Communities.</p>
        </footer>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
