const { Resend } = require("resend");

// In-memory capture for tests (NODE_ENV === "test")
const testInbox = [];

/**
 * Creates and returns a Resend client instance using RESEND_API_KEY.
 */
const getResendClient = () => {
    // If running in test environment, never connect to real Resend API
    if (process.env.NODE_ENV === "test") {
        return null;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return null;
    }

    return new Resend(apiKey);
};

/**
 * Generates modern, responsive branded HTML template for ANOY verification.
 */
const getVerificationEmailTemplate = (otp, username = "there") => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANOY Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0d12;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0c0d12;
      padding: 40px 0;
    }
    .main {
      background-color: #141620;
      margin: 0 auto;
      width: 100%;
      max-width: 520px;
      border-radius: 16px;
      border: 1px solid #232736;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      color: #ffffff;
      font-weight: 800;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px 28px;
      text-align: center;
    }
    .greeting {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 28px;
    }
    .otp-card {
      background: #1e2235;
      border: 1px dashed #6366f1;
      border-radius: 12px;
      padding: 20px 16px;
      margin-bottom: 28px;
      display: inline-block;
      width: 85%;
    }
    .otp-code {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #818cf8;
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      margin: 0;
    }
    .expiry {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 8px;
      display: block;
    }
    .footer {
      border-top: 1px solid #1e2235;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="logo">A</div>
          <h1>Verify Your Email</h1>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="greeting">Hi ${username || "there"},</p>
          <p class="message">
            Thank you for registering on <strong>ANOY</strong>. Use the 6-digit verification code below to confirm your email address and activate your account.
          </p>
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
            <span class="expiry">⏱️ Valid for 10 minutes</span>
          </div>
          <p class="message" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Never share this code with anyone. ANOY staff will never ask for your verification code.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          If you did not request this email, you can safely ignore it.<br>
          © ${new Date().getFullYear()} ANOY Social Network. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `.trim();
};

/**
 * Sends a transactional email using the Resend HTTPS API.
 * @param {object} options - { to, subject, html, text }
 * @returns {Promise<object>} - Send result or mock status.
 */
const sendEmail = async ({ to, subject, html, text }) => {
    // In test environment, capture email in-memory and never connect to external API
    if (process.env.NODE_ENV === "test") {
        const capturedEmail = {
            to,
            subject,
            html,
            text,
            timestamp: new Date()
        };
        testInbox.push(capturedEmail);
        return {
            delivered: true,
            messageId: `test-mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            testCaptured: true,
            email: capturedEmail
        };
    }

    const fromAddress = process.env.EMAIL_FROM || '"ANOY" <noreply@anoyy.tech>';
    const resend = getResendClient();

    if (!resend) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[emailService] RESEND_API_KEY is not configured. Email to ${to} was not dispatched via network.`);
        }
        return {
            delivered: false,
            simulated: true,
            message: "RESEND_API_KEY not configured"
        };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: fromAddress,
            to,
            subject,
            text,
            html
        });

        if (error) {
            console.error(`[emailService] Failed to send email to ${to}:`, error.message || error);
            throw new Error(error.message || "Failed to send email via Resend");
        }

        return {
            delivered: true,
            messageId: data?.id
        };
    } catch (error) {
        console.error(`[emailService] Failed to send email to ${to}:`, error.message);
        throw error;
    }
};

/**
 * Dispatches the 6-digit verification OTP email.
 * @param {string} email - Destination email.
 * @param {string} otp - Plaintext 6-digit OTP.
 * @param {string} username - User's username.
 * @returns {Promise<object>}
 */
const sendVerificationEmail = async (email, otp, username) => {
    const subject = "Your ANOY Verification Code";
    const html = getVerificationEmailTemplate(otp, username);
    const text = `Hi ${username || "there"},\n\nYour ANOY verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.\n\n- The ANOY Team`;

    return await sendEmail({
        to: email,
        subject,
        html,
        text
    });
};

/**
 * Generates modern, responsive branded HTML template for ANOY password reset.
 */
const getPasswordResetEmailTemplate = (otp, username = "there") => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANOY Password Reset Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0d12;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0c0d12;
      padding: 40px 0;
    }
    .main {
      background-color: #141620;
      margin: 0 auto;
      width: 100%;
      max-width: 520px;
      border-radius: 16px;
      border: 1px solid #232736;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      color: #ffffff;
      font-weight: 800;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px 28px;
      text-align: center;
    }
    .greeting {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 28px;
    }
    .otp-card {
      background: #1e2235;
      border: 1px dashed #ef4444;
      border-radius: 12px;
      padding: 20px 16px;
      margin-bottom: 28px;
      display: inline-block;
      width: 85%;
    }
    .otp-code {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #f87171;
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      margin: 0;
    }
    .expiry {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 8px;
      display: block;
    }
    .footer {
      border-top: 1px solid #1e2235;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" class="main" align="center" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="logo">A</div>
          <h1>Password Reset Request</h1>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="greeting">Hi ${username || "there"},</p>
          <p class="message">
            We received a request to reset the password for your <strong>ANOY</strong> account. Use the 6-digit verification code below to proceed with resetting your password.
          </p>
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
            <span class="expiry">⏱️ Valid for 10 minutes</span>
          </div>
          <p class="message" style="font-size: 13px; color: #ef4444; margin-bottom: 0;">
            If you did not request this password reset, your account is still secure. Please do not share this code with anyone.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          If you did not request this email, you can safely ignore it.<br>
          © ${new Date().getFullYear()} ANOY Social Network. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `.trim();
};

/**
 * Dispatches the 6-digit password reset OTP email.
 * @param {string} email - Destination email.
 * @param {string} otp - Plaintext 6-digit OTP.
 * @param {string} username - User's username.
 * @returns {Promise<object>}
 */
const sendPasswordResetEmail = async (email, otp, username) => {
    const subject = "ANOY Password Reset Code";
    const html = getPasswordResetEmailTemplate(otp, username);
    const text = `Hi ${username || "there"},\n\nYour ANOY password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.\n\n- The ANOY Team`;

    return await sendEmail({
        to: email,
        subject,
        html,
        text
    });
};

/**
 * Test helper functions for in-memory email inspection during testing
 */
const getSentEmails = () => [...testInbox];
const getLastSentEmail = () => testInbox[testInbox.length - 1] || null;
const getSentEmailsFor = (to) => testInbox.filter((e) => e.to === to);
const clearSentEmails = () => {
    testInbox.length = 0;
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    getResendClient,
    getSentEmails,
    getLastSentEmail,
    getSentEmailsFor,
    clearSentEmails
};