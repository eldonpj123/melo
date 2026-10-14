import { cleanEmail, json, readDb, writeDb } from "./_db.js";

export default function handler(req, res) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = cleanEmail(req.query?.email || body?.email);
  if (!email) return json(res, 400, { success: false, message: "Email is required" });
  const db = readDb();
  db.likedSongs[email] ||= [];

  if (req.method === "GET") {
    return json(res, 200, { success: true, email, likedSongs: db.likedSongs[email] });
  }

  if (req.method === "POST") {
    const { track } = body || {};
    if (!track?.id) return json(res, 400, { success: false, message: "Track with ID is required" });
    const trackIdStr = String(track.id);
    if (!db.likedSongs[email].some((song) => String(song.id) === trackIdStr)) {
      db.likedSongs[email].unshift({
        id: trackIdStr,
        title: track.title || "Track",
        artist: track.artist || "Artist",
        album: track.album || "Single",
        cover: track.cover || "",
        duration: track.duration || 180,
        audioUrl: track.audioUrl || "",
        genre: track.genre || "Music",
        likedAt: Date.now()
      });
    }
  } else if (req.method === "DELETE") {
    const { trackId } = body || {};
    if (!trackId) return json(res, 400, { success: false, message: "trackId is required" });
    const trackIdStr = String(trackId);
    db.likedSongs[email] = db.likedSongs[email].filter((song) => String(song.id) !== trackIdStr);
  } else {
    return json(res, 405, { success: false, message: "Method not allowed" });
  }

  try {
    writeDb(db);
  } catch (error) {
    console.error("[v0] Liked songs database write failed:", error);
    // Still return 200 with in-memory list so user flow doesn't fail
    return json(res, 200, { success: true, likedSongs: db.likedSongs[email], warning: "Cloud sync temporary issue" });
  }
  return json(res, 200, { success: true, likedSongs: db.likedSongs[email] });
}

