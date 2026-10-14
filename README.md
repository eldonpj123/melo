# Melo Spatial Studio 🎵 • 320kbps Lossless Audio Engine

![Melo Spatial Studio](https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80)

An ultra-premium, bespoke spatial music streaming web application designed for high-fidelity audiophiles. Features direct 320kbps JioSaavn CDN audio decryption, synchronized karaoke lyrics, real-time Web Audio API spectrum analysis, an intelligent ad-blocking engine, and database-backed account persistence with real Gmail OTP verification.

---

## ✨ Key Features

- **Unique Luxury Spatial Architecture**: Non-Spotify custom design with an ambient nebula backdrop, floating spatial command dock, and an interactive 3D vinyl turntable deck with continuous spin and tone reflections.
- **Direct 320kbps CDN Decryption**: Search any track or artist on Earth and stream directly in 320kbps studio bitrate with zero commercial interruptions.
- **Synchronized Karaoke Lyrics Engine**: Real-time synchronized lyrics sheet with active line tracking and auto-scrolling.
- **Live Web Audio API Spectrum Analyser**: Real-time frequency analyser rendering soundwaves directly to an interactive HTML5 canvas.
- **Persistent Database Storage**: Liked songs and user profiles are stored in an atomic server-side JSON database (`data/database.json`), keyed to authenticated accounts.
- **Secure Gmail SMTP OTP Verification & Password Login**:
  - Full password authentication with salted SHA-256 password hashing.
  - Verification codes delivered directly to real Gmail inboxes via Nodemailer with zero on-screen code exposure.
- **Cybernetic Ad-Shield**: Commercial-free filtering engine with a live blocked-audio tracker and toggle switch.
- **Full Mobile Responsiveness**: Touch-optimized interface for smartphones with a floating mini-player dock and native-feeling bottom navigation bar.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 2. Installation
```bash
# Clone or navigate to the repository
cd melo

# Install dependencies
npm install
```

### 3. Environment Variables (Optional for Real Gmail OTP)
Create a `.env` file in the root directory (refer to `.env.example`):
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_digit_google_app_password
```
> **Note**: To generate a Google App Password, visit [Google Security](https://myaccount.google.com/security) with 2-Step Verification enabled and generate an app password under **App Passwords**.

### 4. Development Server
```bash
npm run dev
```
The application will launch locally at `http://localhost:5173`.

### 5. Production Build
```bash
npm run build
```

---

## 🛠 Tech Stack

- **Frontend**: Vanilla ES6+ JavaScript, HTML5 Canvas, Web Audio API, Modern Vanilla CSS with Obsidian Glassmorphism.
- **Audio Engine**: Direct HTML5 Audio with live gain nodes and analyser nodes.
- **Backend & Middleware**: Node.js & Vite Connect Middleware (`vite.config.js`).
- **Database**: Atomic JSON persistence (`data/database.json`) with salted cryptographic hashing.
- **Mailing**: Nodemailer with Gmail SMTP integration.

---

## 🔒 Security & Privacy

- Sensitive credentials (`.env`) are strictly excluded via `.gitignore`.
- OTP codes are never leaked to client toasts or inspectable DOM elements.
- Liked songs and passwords are tied to specific verified user emails.

---

## 📄 License
MIT License. Created with ❤️ for audiophiles everywhere.
