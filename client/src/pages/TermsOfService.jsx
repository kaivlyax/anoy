import { Link } from "react-router-dom";
import AnoyLogo from "../components/AnoyLogo";
import { ArrowLeftIcon, AlertCircleIcon, ShieldIcon } from "../components/Icons";

function TermsOfService() {
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
              ANOY is currently operating under pilot campus deployment. These Terms of Service represent our platform operational rules and will undergo comprehensive institutional legal and regulatory review with university administration prior to formal institution-wide release.
            </p>
          </div>
        </div>

        <main className="legal-content">
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-effective-date">Last Updated: September 2026</p>

          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing, registering for, or using ANOY (&ldquo;Apna Social Space&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;) and our Privacy Policy. If you do not agree to these Terms, do not register for or use the platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Eligibility & Community Standards</h2>
            <p>
              ANOY is designed for campus students, faculty, and academic communities. By using the platform, you represent and warrant that:
            </p>
            <ul>
              <li>You will provide accurate account information and maintain the security of your credentials.</li>
              <li>You will treat other campus members with mutual respect, empathy, and integrity.</li>
              <li>You will not engage in cyberbullying, harassment, stalking, hate speech, defamation, or unauthorized impersonation of students, staff, or university officials.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Platform Governance & Administrative Authority</h2>
            <p>
              ANOY operates a multi-tiered governance structure to preserve platform safety, integrity, and compliance:
            </p>
            <ul>
              <li>
                <strong>Platform Roles:</strong> Accounts are assigned system roles (<code>USER</code>, <code>MODERATOR</code>, <code>SUPPORT</code>, <code>ADMIN</code>). Platform administrators hold authorized governance oversight.
              </li>
              <li>
                <strong>Community Autonomy:</strong> Community owners and designated moderators manage community chat channels, member rosters, and decorations within their respective spaces.
              </li>
              <li>
                <strong>Administrative Safety Enforcement:</strong> Platform administrators reserve the right to investigate safety reports, remove non-compliant content, issue interaction restrictions, and globally ban accounts violating platform standards.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. User Content & Conduct Guidelines</h2>
            <p>You retain ownership of the content you create and share on ANOY. However, you agree not to upload, post, or transmit content that:</p>
            <ul>
              <li>Violates university codes of conduct, intellectual property rights, or applicable laws.</li>
              <li>Contains malicious software, phishing links, automated bots, or spam payloads.</li>
              <li>Exposes non-consensual personal information, private photographs, or sensitive academic credentials.</li>
              <li>Attempts unauthorized extraction, automated scraping, or reverse engineering of platform APIs or user directories.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Interaction Restrictions & Account Sanctions</h2>
            <p>
              To maintain healthy campus discourse without immediate punitive account termination, ANOY maintains a dual-tier sanction system:
            </p>
            <ul>
              <li>
                <strong>Interaction Restrictions:</strong> Accounts involved in low-level violations, spam, or disputes may be placed into read-only restriction mode (temporary or permanent). Restricted users may browse feeds and read content, but are blocked from posting, commenting, reacting, or sending messages.
              </li>
              <li>
                <strong>Global Bans:</strong> Severe violations (including threats of violence, hate speech, severe harassment, or security compromises) will result in immediate global account bans, terminating active sessions and preventing further platform access.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Real-Time Rooms & Video Communications</h2>
            <p>
              Meeting rooms and virtual study spaces are provided for collaborative academic work. Users must adhere to respectful audio, video, and screen-sharing etiquette. Unauthorized recording, broadcasting, or redistribution of private room interactions without participant consent is strictly prohibited.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Disclaimer of Warranties & Limitation of Liability</h2>
            <p>
              ANOY is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis during pilot deployment. While we strive for continuous platform reliability and data integrity, ANOY makes no warranties that the service will be uninterrupted, error-free, or entirely secure at all times.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Modifications to Terms</h2>
            <p>
              We may revise these Terms periodically to reflect technical enhancements, policy updates, or university compliance requirements. Continued use of ANOY following posted revisions constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Contact Information</h2>
            <p>
              For legal notices, compliance queries, or policy feedback, please contact us at <a href="mailto:support@anoyy.tech" className="legal-email-link">support@anoyy.tech</a>.
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

export default TermsOfService;
