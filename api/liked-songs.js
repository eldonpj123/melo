import { cleanEmail, json, readDb, writeDb } from "./_db.js";

export default function handler(req, res) {
  const email = cleanEmail(req.query?.email || req.body?.email);
  if (!email) return json(res, 400, { success: false, message: "Email is required" });
  const db = readDb();
  db.likedSongs[email] ||= [];

  if (req.method === "GET") return json(res, 200, { success: true, email, likedSongs: db.likedSongs[email] });
  if (req.method === "POST") {
    const { track } = req.body || {};
    if (!track?.id) return json(res, 400, { success: false, message: "Track with ID is required" });
    if (!db.likedSongs[email].some((song) => song.id === track.id)) {
      db.likedSongs[email].unshift({ id: track.id, title: track.title || "Track", artist: track.artist || "Artist", album: track.album || "Single", cover: track.cover || "", duration: track.duration || 180, audioUrl: track.audioUrl || "", genre: track.genre || "Music", likedAt: Date.now() });
    }
  } else if (req.method === "DELETE") {
    const { trackId } = req.body || {};
    if (!trackId) return json(res, 400, { success: false, message: "trackId is required" });
    db.likedSongs[email] = db.likedSongs[email].filter((song) => song.id !== trackId);
  } else return json(res, 405, { success: false, message: "Method not allowed" });

  try { writeDb(db); } catch (error) { console.error("[v0] Liked songs database write failed:", error); return json(res, 500, { success: false, message: "Database storage is unavailable right now." }); }
  return json(res, 200, { success: true, likedSongs: db.likedSongs[email] });
}
