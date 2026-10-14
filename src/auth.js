// Melo Authentication & Database Service
// Supports secure password login, real Gmail OTP verification (/api/send-otp),
// and account-bound data persistence (/api/auth/* & /api/liked-songs).

export class AuthManager {
  constructor() {
    this.storageKey = "melo_auth_user";
    this.pendingKey = "melo_pending_otp";
    this.currentUser = JSON.parse(localStorage.getItem(this.storageKey) || "null");
    
    // Check pending OTP session
    const savedPending = JSON.parse(sessionStorage.getItem(this.pendingKey) || "null");
    if (savedPending && savedPending.expiresAt > Date.now()) {
      this.pendingEmail = savedPending.email;
      this.activeOtp = savedPending.otp;
      this.otpExpiresAt = savedPending.expiresAt;
      this.pendingPassword = savedPending.password || null;
      this.pendingMode = savedPending.mode || "signup";
    } else {
      this.pendingEmail = null;
      this.activeOtp = null;
      this.otpExpiresAt = null;
      this.pendingPassword = null;
      this.pendingMode = null;
      sessionStorage.removeItem(this.pendingKey);
    }

    this.toastHideTimer = null;
    this.onAuthStateChanged = null;
  }

  isAuthenticated() {
    return !!this.currentUser && !!this.currentUser.email;
  }

  getUser() {
    return this.currentUser;
  }

  formatNameFromEmail(email) {
    if (!email) return "Melo Listener";
    const rawName = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    return rawName
      .split(" ")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  // Login with Email and Password against database
  async loginWithPassword(email, password) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password) {
      throw new Error("Please enter your password.");
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to log in. Please check your credentials.");
      }

      const user = data.user;
      this.currentUser = user;
      localStorage.setItem(this.storageKey, JSON.stringify(user));

      if (this.onAuthStateChanged) {
        this.onAuthStateChanged(this.currentUser);
      }

      return {
        user: user,
        likedSongs: data.likedSongs || []
      };

    } catch (err) {
      console.warn("Login error:", err);
      throw err;
    }
  }

  // Register new account with Password into database
  async registerWithPassword(email, password, name = null) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password, name })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create account.");
      }

      const user = data.user;
      this.currentUser = user;
      localStorage.setItem(this.storageKey, JSON.stringify(user));

      if (this.onAuthStateChanged) {
        this.onAuthStateChanged(this.currentUser);
      }

      return {
        user: user,
        likedSongs: []
      };

    } catch (err) {
      console.warn("Registration error:", err);
      throw err;
    }
  }

  async accountExists(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return false;
    const response = await fetch(`/api/auth/exists?email=${encodeURIComponent(cleanEmail)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not check this email right now.");
    }
    return Boolean(data.exists);
  }

  // Generate and send 6-digit OTP to real Gmail (without revealing or autofilling OTP on screen)
  async sendOtp(email, mode = "signup", pendingPassword = null) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw new Error("Please enter a valid email address (e.g. name@example.com).");
    }

    // Generate random 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes validity

    this.pendingEmail = cleanEmail;
    this.activeOtp = otp;
    this.otpExpiresAt = expiresAt;
    this.pendingPassword = pendingPassword;
    this.pendingMode = mode;

    sessionStorage.setItem(this.pendingKey, JSON.stringify({
      email: cleanEmail,
      otp: otp,
      expiresAt: expiresAt,
      password: pendingPassword,
      mode: mode
    }));

    let realEmailSent = false;
    let realEmailError = null;

    // Dispatch real email via Gmail backend endpoint (/api/send-otp)
    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, otp })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        realEmailError = data.message || data.error || "The verification email could not be sent.";
        throw new Error(realEmailError);
      }
      realEmailSent = true;
    } catch (err) {
      sessionStorage.removeItem(this.pendingKey);
      this.pendingEmail = null;
      this.activeOtp = null;
      this.otpExpiresAt = null;
      this.pendingPassword = null;
      this.pendingMode = null;
      realEmailError = err.message || "The verification email could not be sent.";
      console.error("OTP delivery failed:", err);
      throw new Error(`${realEmailError} Please check the Gmail App Password configuration and try again.`);
    }

    // Display delivery notification only after the server confirms delivery.
    this.showEmailToast(cleanEmail, { realEmailSent, realEmailError, mode });

    return {
      success: true,
      email: cleanEmail,
      realEmailSent: true,
      expiresIn: 600
    };
  }

  // Verify entered 6-digit code and complete account registration/login
  async verifyOtp(enteredCode) {
    if (!this.activeOtp || !this.pendingEmail) {
      throw new Error("No active OTP request found. Please request a new code.");
    }

    if (Date.now() > this.otpExpiresAt) {
      sessionStorage.removeItem(this.pendingKey);
      throw new Error("Verification code has expired. Please request a new code.");
    }

    const cleanInput = (enteredCode || "").replace(/\s+/g, "");
    if (cleanInput !== this.activeOtp) {
      throw new Error("Invalid verification code. Please check your inbox for the code.");
    }

    const targetEmail = this.pendingEmail;
    const pendingPass = this.pendingPassword;
    const mode = this.pendingMode;

    // Clear pending OTP state
    this.activeOtp = null;
    this.pendingEmail = null;
    this.otpExpiresAt = null;
    this.pendingPassword = null;
    this.pendingMode = null;
    sessionStorage.removeItem(this.pendingKey);

    // A verified signup must be persisted in the file database. Do not fall back
    // to a browser-only account when persistence fails or the email is duplicated.
    if (mode === "signup" && pendingPass) {
      const regResult = await this.registerWithPassword(targetEmail, pendingPass);
      this.dismissToast();
      return regResult.user;
    }

    // Fallback: Create or retrieve user session
    const displayName = this.formatNameFromEmail(targetEmail);
    const initial = displayName.charAt(0).toUpperCase() || "M";

    const user = {
      email: targetEmail,
      name: displayName,
      initial: initial,
      joinedAt: Date.now(),
      isVerified: true
    };

    this.currentUser = user;
    localStorage.setItem(this.storageKey, JSON.stringify(user));

    this.dismissToast();

    if (this.onAuthStateChanged) {
      this.onAuthStateChanged(this.currentUser);
    }

    return user;
  }

  dismissToast() {
    const toast = document.getElementById("email-otp-toast");
    if (toast) toast.classList.remove("visible");
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.storageKey);
    if (this.onAuthStateChanged) {
      this.onAuthStateChanged(null);
    }
  }

  // Show clean email dispatch notification (Compact, small floating capsule)
  showEmailToast(email, status = {}) {
    let toast = document.getElementById("email-otp-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "email-otp-toast";
      toast.className = "email-toast-banner";
      document.body.appendChild(toast);
    }

    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer);
      this.toastHideTimer = null;
    }

    toast.innerHTML = `
      <div class="toast-content" style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #00f59b; display: flex; align-items: center;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></span>
        <span style="color: #fff; font-size: 0.8rem; font-weight: 600;">Code sent to ${email}</span>
        <button class="toast-close" id="toast-close-btn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; margin-left: 6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
    `;

    toast.classList.remove("hidden");
    void toast.offsetWidth;
    toast.classList.add("visible");

    // Close button handler
    document.getElementById("toast-close-btn")?.addEventListener("click", () => {
      toast.classList.remove("visible");
    });

    this.toastHideTimer = setTimeout(() => {
      if (toast) toast.classList.remove("visible");
    }, 6000);
  }

  // Display Gmail Configuration Status Modal
  async openEnvGuideModal() {
    let modal = document.getElementById("env-guide-modal");
    if (modal) modal.remove();

    let configured = true;
    let senderEmail = "musicmelo456@gmail.com";

    try {
      const res = await fetch("/api/email-status");
      if (res.ok) {
        const data = await res.json();
        configured = !!data.configured;
        if (data.user) senderEmail = data.user;
      }
    } catch (e) {
      // ignore
    }

    modal = document.createElement("div");
    modal.id = "env-guide-modal";
    modal.className = "modal-overlay";
    modal.style.zIndex = "1200";

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 520px; padding: 26px; background: #181818; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 24px 60px rgba(0,0,0,0.9);">
        <div class="modal-header" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-envelope-circle-check" style="color: var(--spotify-green);"></i>
            <span>Gmail OTP Verification (.env)</span>
          </h3>
          <button id="close-env-modal-btn" style="background: none; border: none; color: var(--text-sub); font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="font-size: 0.88rem; color: var(--text-sub); line-height: 1.5; margin-bottom: 18px;">
          Real 6-digit OTP verification codes are dispatched automatically via your configured Gmail account directly to listener inboxes.
        </div>

        <!-- Current Key Status Checklist -->
        <div style="background: #222; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 0.8rem; font-weight: 700; color: #fff; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Current Credentials Status:</div>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.84rem;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span><code>GMAIL_USER</code></span>
              <span style="color: ${configured ? '#1DB954' : '#ffaa00'}; font-weight: 700;">
                <i class="fa-solid ${configured ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${configured ? `Connected (${senderEmail})` : 'Missing in .env'}
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span><code>GMAIL_APP_PASSWORD</code></span>
              <span style="color: ${configured ? '#1DB954' : '#ffaa00'}; font-weight: 700;">
                <i class="fa-solid ${configured ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${configured ? 'Active (16-char App Password)' : 'Missing in .env'}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="dismiss-env-modal-btn" class="btn-primary" style="padding: 10px 22px; border-radius: 50px; font-weight: 700; font-size: 0.9rem; cursor: pointer; border: none;">
            Got it
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("close-env-modal-btn")?.addEventListener("click", () => modal.remove());
    document.getElementById("dismiss-env-modal-btn")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
