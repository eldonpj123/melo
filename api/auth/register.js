import { cleanEmail, displayName, hashPassword, json, readDb, writeDb, publicUser } from "../_db.js";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { success: false, message: "Method not allowed" });
  const { email, password, name } = req.body || {};
  const clean = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return json(res, 400, { success: false, message: "Valid email address is required" });
  if (typeof password !== "string" || password.length < 6) return json(res, 400, { success: false, message: "Password must be at least 6 characters" });

  const db = readDb();
  if (db.users.some((user) => user.email === clean)) return json(res, 409, { success: false, message: "An account with this email already exists. Please log in." });
  const userName = displayName(clean, name);
  const user = { id: `usr_${Date.now()}`, email: clean, password: hashPassword(password), name: userName, initial: userName.charAt(0).toUpperCase() || "M", createdAt: Date.now(), isVerified: true };
  db.users.push(user);
  db.likedSongs[clean] ||= [];
  try { writeDb(db); } catch (error) { console.error("[v0] User database write failed:", error); return json(res, 500, { success: false, message: "Account storage is unavailable right now." }); }
  return json(res, 200, { success: true, user: publicUser(user), likedSongs: [] });
}
