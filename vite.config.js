import { defineConfig, loadEnv } from "vite";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.resolve(process.cwd(), "data", "database.json");

// Helper to safely read database
function getDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initData = { users: [], likedSongs: {} };
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(initData, null, 2), "utf8");
      return initData;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!Array.isArray(parsed.users)) parsed.users = [];
    if (!parsed.likedSongs || typeof parsed.likedSongs !== "object") parsed.likedSongs = {};
    return parsed;
  } catch (err) {
    console.error("Error reading database file:", err);
    return { users: [], likedSongs: {} };
  }
}

// Helper to safely write database
function saveDb(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error saving database file:", err);
    return false;
  }
}

// Helper to hash password with salt
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "_melo_salt_2026").digest("hex");
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["localhost", ".vercel.run"],
      port: 5173,
      proxy: {
        "/api/music": {
          target: "https://www.jiosaavn.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/music/, "")
        }
      }
    },
    plugins: [
      {
        name: "melo-backend-service",
        configureServer(server) {
          // 1. Email status
          server.middlewares.use("/api/email-status", (req, res) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            const currentEnv = loadEnv(mode, process.cwd(), "");
            const gmailUser = (currentEnv.GMAIL_USER || process.env.GMAIL_USER || "").trim();
            const gmailPass = (currentEnv.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
            res.end(JSON.stringify({
              configured: Boolean(gmailUser && gmailPass),
              user: gmailUser || null
            }));
          });

          // 2. Dispatch real OTP verification email via Gmail
          server.middlewares.use("/api/send-otp", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            const { email, otp } = await parseJsonBody(req);
            if (!email || !otp) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Email and OTP are required" }));
              return;
            }

            const currentEnv = loadEnv(mode, process.cwd(), "");
            const gmailUser = (currentEnv.GMAIL_USER || process.env.GMAIL_USER || "").trim();
            const gmailPass = (currentEnv.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");

            if (!gmailUser || !gmailPass) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: false,
                configured: false,
                message: "Gmail credentials not set in .env"
              }));
              return;
            }

            try {
              const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  user: gmailUser,
                  pass: gmailPass
                }
              });

              await transporter.sendMail({
                from: `"Melo Music" <${gmailUser}>`,
                to: email,
                subject: `Melo Music - Verification Code: ${otp}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 32px; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #282828;">
                    <div style="margin-bottom: 24px;">
                      <h2 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">melo<span style="color: #1DB954; font-size: 14px; margin-left: 4px;">MUSIC</span></h2>
                    </div>
                    <h3 style="color: #ffffff; font-size: 19px; margin-top: 0; margin-bottom: 8px;">Your Verification Code</h3>
                    <p style="color: #a7a7a7; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Use the 6-digit verification code below to complete your login or registration on Melo:</p>
                    
                    <div style="background: rgba(29, 185, 84, 0.1); border: 2px dashed #1DB954; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0;">
                      <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1DB954; font-family: monospace;">${otp}</span>
                      <div style="font-size: 12px; color: #a7a7a7; margin-top: 6px;">Expires in 10 minutes</div>
                    </div>
                    
                    <p style="color: #a7a7a7; font-size: 13px; line-height: 1.4;">If you did not make this request, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />
                    <p style="color: #666666; font-size: 11px; margin: 0;">Melo Music Engine • Ad-Free 320kbps Music Streaming</p>
                  </div>
                `
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: true,
                configured: true,
                message: `Real verification email sent to ${email} via Gmail`
              }));

            } catch (err) {
              console.error("Gmail OTP Send Error:", err);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: false,
                configured: true,
                error: err.message || "Failed to send email via Gmail"
              }));
            }
          });

          // 3. User Registration with Password
          server.middlewares.use("/api/auth/register", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            res.setHeader("Content-Type", "application/json");
            const { email, password, name } = await parseJsonBody(req);
            const cleanEmail = (email || "").trim().toLowerCase();

            if (!cleanEmail || !cleanEmail.includes("@")) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: "Valid email address is required" }));
              return;
            }

            if (!password || password.length < 6) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: "Password must be at least 6 characters" }));
              return;
            }

            const db = getDb();
            const existingUser = db.users.find((u) => u.email === cleanEmail);

            if (existingUser) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: "An account with this email already exists. Please log in." }));
              return;
            }

            const rawName = name || cleanEmail.split("@")[0];
            const displayName = rawName
              .replace(/[._-]+/g, " ")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");

            const newUser = {
              id: "usr_" + Date.now(),
              email: cleanEmail,
              password: hashPassword(password),
              name: displayName,
              initial: displayName.charAt(0).toUpperCase() || "M",
              createdAt: Date.now(),
              isVerified: true
            };

            db.users.push(newUser);
            if (!db.likedSongs[cleanEmail]) {
              db.likedSongs[cleanEmail] = [];
            }
            saveDb(db);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                initial: newUser.initial,
                isVerified: true
              },
              likedSongs: []
            }));
          });

          // 4. User Login with Password
          server.middlewares.use("/api/auth/login", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            res.setHeader("Content-Type", "application/json");
            const { email, password } = await parseJsonBody(req);
            const cleanEmail = (email || "").trim().toLowerCase();

            if (!cleanEmail || !password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: "Email and password are required" }));
              return;
            }

            const db = getDb();
            const user = db.users.find((u) => u.email === cleanEmail);

            if (!user) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, message: "No account found with this email. Please sign up." }));
              return;
            }

            const hashedInput = hashPassword(password);
            if (user.password !== hashedInput) {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, message: "Incorrect password. Please try again." }));
              return;
            }

            const userLikedSongs = db.likedSongs[cleanEmail] || [];

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                initial: user.initial,
                isVerified: user.isVerified
              },
              likedSongs: userLikedSongs
            }));
          });

          // 5. Liked Songs Database API (GET, POST, DELETE, PUT)
          server.middlewares.use("/api/liked-songs", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            const url = new URL(req.url, "http://localhost");

            // GET /api/liked-songs?email=...
            if (req.method === "GET") {
              const email = (url.searchParams.get("email") || "").trim().toLowerCase();
              if (!email) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: "Email query param required" }));
                return;
              }

              const db = getDb();
              const songs = db.likedSongs[email] || [];
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                email: email,
                likedSongs: songs
              }));
              return;
            }

            // POST /api/liked-songs (Add a liked song to database)
            if (req.method === "POST") {
              const { email, track } = await parseJsonBody(req);
              const cleanEmail = (email || "").trim().toLowerCase();

              if (!cleanEmail || !track || !track.id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: "Email and track object with ID required" }));
                return;
              }

              const db = getDb();
              if (!db.likedSongs[cleanEmail]) {
                db.likedSongs[cleanEmail] = [];
              }

              const existingIdx = db.likedSongs[cleanEmail].findIndex((s) => s.id === track.id);
              if (existingIdx === -1) {
                db.likedSongs[cleanEmail].unshift({
                  id: track.id,
                  title: track.title || "Track",
                  artist: track.artist || "Artist",
                  album: track.album || "Single",
                  cover: track.cover || "",
                  duration: track.duration || 180,
                  audioUrl: track.audioUrl || "",
                  genre: track.genre || "Music",
                  likedAt: Date.now()
                });
                saveDb(db);
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                likedSongs: db.likedSongs[cleanEmail]
              }));
              return;
            }

            // DELETE /api/liked-songs (Remove liked song from database)
            if (req.method === "DELETE") {
              const { email, trackId } = await parseJsonBody(req);
              const cleanEmail = (email || "").trim().toLowerCase();

              if (!cleanEmail || !trackId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: "Email and trackId required" }));
                return;
              }

              const db = getDb();
              if (db.likedSongs[cleanEmail]) {
                db.likedSongs[cleanEmail] = db.likedSongs[cleanEmail].filter((s) => s.id !== trackId);
                saveDb(db);
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                likedSongs: db.likedSongs[cleanEmail] || []
              }));
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
          });
        }
      }
    ]
  };
});
