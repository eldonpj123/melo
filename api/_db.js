import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "database.json");
const TMP_DB_PATH = path.join("/tmp", "database.json");

function getDbPath(forWrite = false) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return TMP_DB_PATH;
  }
  return LOCAL_DB_PATH;
}

export function readDb() {
  const targetPath = getDbPath(false);
  
  // On Vercel, initialize /tmp/database.json from bundled LOCAL_DB_PATH if not yet copied
  if (targetPath === TMP_DB_PATH && !fs.existsSync(TMP_DB_PATH) && fs.existsSync(LOCAL_DB_PATH)) {
    try {
      fs.mkdirSync("/tmp", { recursive: true });
      fs.copyFileSync(LOCAL_DB_PATH, TMP_DB_PATH);
    } catch (e) {
      // ignore
    }
  }

  try {
    const raw = fs.readFileSync(fs.existsSync(targetPath) ? targetPath : LOCAL_DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      likedSongs: parsed.likedSongs && typeof parsed.likedSongs === "object" ? parsed.likedSongs : {}
    };
  } catch {
    return { users: [], likedSongs: {} };
  }
}

export function writeDb(db) {
  const targetPath = getDbPath(true);
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    // If writing to process.cwd() failed due to read-only filesystem, fallback to /tmp
    try {
      fs.mkdirSync("/tmp", { recursive: true });
      fs.writeFileSync(TMP_DB_PATH, JSON.stringify(db, null, 2), "utf8");
    } catch (fallbackErr) {
      console.error("Database write error:", fallbackErr);
      throw fallbackErr;
    }
  }
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
