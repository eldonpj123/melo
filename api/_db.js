import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DB_PATH = path.join(process.cwd(), "data", "database.json");

export function readDb() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      likedSongs: parsed.likedSongs && typeof parsed.likedSongs === "object" ? parsed.likedSongs : {}
    };
  } catch {
    return { users: [], likedSongs: {} };
  }
}

export function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(`${password}_melo_salt_2026`).digest("hex");
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, initial: user.initial, isVerified: user.isVerified };
}

export function json(res, status, body) {
  res.status(status).json(body);
}

export function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function displayName(email, name) {
  return String(name || email.split("@")[0]).replace(/[._-]+/g, " ").split(" ").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
