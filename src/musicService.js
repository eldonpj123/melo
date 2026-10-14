// Music Service API Integration
// Delivers high-definition 320kbps audio streams with ad-free filtering & live search
import CryptoJS from "crypto-js";

export class MusicService {
  constructor() {
    this.desKey = CryptoJS.enc.Utf8.parse("38346591");
  }

  // Decrypts JioSaavn CDN encrypted stream URLs into direct 320kbps MP4/MP3 audio
  decryptAudioUrl(encryptedBase64) {
    if (!encryptedBase64) return null;
    try {
      const decrypted = CryptoJS.DES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedBase64) },
        this.desKey,
        { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
      );
      const url = decrypted.toString(CryptoJS.enc.Utf8);
      if (!url) return null;
      
      // Upgrade bitrate to pristine 320kbps and ensure HTTPS
      return url
        .replace(/^http:/, "https:")
        .replace(/_96\.mp4$/, "_320.mp4")
        .replace(/_160\.mp4$/, "_320.mp4");
    } catch (err) {
      console.warn("Failed to decrypt audio stream URL:", err);
      return null;
    }
  }

  decodeHtml(str) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  // Format JioSaavn song item to standard Melo track object
  formatSong(raw) {
    const audioUrl = this.decryptAudioUrl(raw.encrypted_media_url);
    if (!audioUrl) return null;

    const title = this.decodeHtml(raw.song || raw.title || "Unknown Track");
    const artist = this.decodeHtml(raw.primary_artists || raw.singers || raw.music || "Popular Artist");
    const album = this.decodeHtml(raw.album || "Single");
    const rawImage = raw.image || "";
    const cover = rawImage
      .replace("150x150.jpg", "500x500.jpg")
      .replace("50x50.jpg", "500x500.jpg");

    const duration = parseInt(raw.duration) || 180;
    const year = raw.year || "";
    const language = raw.language ? raw.language.toUpperCase() : "GLOBAL";

    return {
      id: `saavn-${raw.id}`,
      title: title,
      artist: artist,
      album: album,
      duration: duration,
      cover: cover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
      audioUrl: audioUrl,
      genre: `${language} • 320kbps HD`,
      popular: true,
      isAd: false,
      lyrics: [
        { time: 0, text: `♪ ${title} ♪` },
        { time: 6, text: `Artist: ${artist}` },
        { time: 14, text: `Album: ${album} (${year})` },
        { time: 24, text: "Ad-Blocker Active: Commercial-Free Studio Stream" },
        { time: 38, text: "High Fidelity 320kbps AAC Audio Engine" }
      ]
    };
  }

  // Search for songs by keyword/title/artist
  async searchSongs(query) {
    if (!query || !query.trim()) return [];
    const cleanQ = query.trim();

    // 1. Primary: Use Vite proxy route
    const proxyUrl = `/api/music/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=20&q=${encodeURIComponent(cleanQ)}`;
    
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && Array.isArray(data.results)) {
          const songs = data.results
            .map(s => this.formatSong(s))
            .filter(Boolean);
          if (songs.length > 0) return songs;
        }
      }
    } catch (err) {
      console.warn("Vite proxy music search error, trying fallback...", err);
    }

    // 2. Fallback: Query via public CORS gateway
    try {
      const fallbackTarget = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=20&q=${encodeURIComponent(cleanQ)}`;
      const gatewayUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fallbackTarget)}`;
      const res = await fetch(gatewayUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && Array.isArray(data.results)) {
          const songs = data.results
            .map(s => this.formatSong(s))
            .filter(Boolean);
          if (songs.length > 0) return songs;
        }
      }
    } catch (err) {
      console.warn("Public proxy search error:", err);
    }

    // 3. Secondary Fallback: Query Audius API for open indie/EDM songs
    try {
      const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(cleanQ)}&app_name=melo`;
      const res = await fetch(audiusUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data)) {
          return json.data.slice(0, 15).map(item => ({
            id: `audius-${item.id}`,
            title: item.title,
            artist: item.user?.name || "Audius Artist",
            album: item.genre || "Original Track",
            duration: item.duration || 180,
            cover: item.artwork?.["480x480"] || item.artwork?.["150x150"] || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
            audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${item.id}/stream?app_name=melo`,
            genre: "Audius Ad-Free",
            popular: true,
            isAd: false,
            lyrics: [
              { time: 0, text: `♪ ${item.title} ♪` },
              { time: 10, text: `Streamed Ad-Free via Open Audio Network` }
            ]
          }));
        }
      }
    } catch (err) {
      console.warn("Audius fallback error:", err);
    }

    return [];
  }

  // Fetch trending/top songs for initial catalog enrichment
  async getTrendingHits() {
    return this.searchSongs("Top Hits 2024");
  }
}
