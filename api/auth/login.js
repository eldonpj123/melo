import { cleanEmail, hashPassword, json, publicUser, readDb } from "../_db.js";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { success: false, message: "Method not allowed" });
  const { email, password } = req.body || {};
  const clean = cleanEmail(email);
  if (!clean || typeof password !== "string") return json(res, 400, { success: false, message: "Email and password are required" });
  const db = readDb();
  const user = db.users.find((candidate) => candidate.email === clean);
  if (!user) return json(res, 404, { success: false, message: "No account found with this email. Please sign up." });
  if (user.password !== hashPassword(password)) return json(res, 401, { success: false, message: "Incorrect password. Please try again." });
  return json(res, 200, { success: true, user: publicUser(user), likedSongs: db.likedSongs[clean] || [] });
}
