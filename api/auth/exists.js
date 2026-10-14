import { cleanEmail, json, readDb } from "../_db.js";

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { success: false, message: "Method not allowed" });
  const email = cleanEmail(req.query?.email);
  if (!email) return json(res, 400, { success: false, message: "Email is required" });
  const exists = readDb().users.some((user) => user.email === email);
  return json(res, 200, { success: true, exists });
}
