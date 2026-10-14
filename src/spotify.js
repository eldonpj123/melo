// Spotify Web API Integration Module
// Handles PKCE Authentication, API requests (Search, Playlists, Tracks, User Profile)

export class SpotifyAPIClient {
  constructor() {
    this.clientId = localStorage.getItem("spotify_client_id") || "";
    this.accessToken = localStorage.getItem("spotify_access_token") || "";
    this.refreshToken = localStorage.getItem("spotify_refresh_token") || "";
    this.tokenExpiry = localStorage.getItem("spotify_token_expiry") || 0;
    // Spotify strictly disallows 'localhost'; use loopback 127.0.0.1 for local dev
    let origin = window.location.origin;
    if (origin.includes("localhost")) {
      origin = origin.replace("localhost", "127.0.0.1");
    }
    this.redirectUri = origin.endsWith("/") ? origin : origin + "/";
  }

  setClientId(clientId) {
    this.clientId = clientId;
    localStorage.setItem("spotify_client_id", clientId);
  }

  setAccessToken(token, expiresInSeconds = 3600) {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem("spotify_access_token", token);
    localStorage.setItem("spotify_token_expiry", this.tokenExpiry);
  }

  isConfigured() {
    return !!this.clientId;
  }

  isAuthenticated() {
    return !!this.accessToken && Date.now() < parseInt(this.tokenExpiry);
  }

  // Spotify PKCE Auth URL Generator
  async redirectToSpotifyAuth() {
    if (!this.clientId) {
      alert("Please configure your Spotify Client ID first in Settings!");
      return;
    }

    const verifier = this.generateRandomString(128);
    const challenge = await this.generateCodeChallenge(verifier);

    localStorage.setItem("spotify_code_verifier", verifier);

    const scopes = [
      "user-read-private",
      "user-read-email",
      "user-library-read",
      "playlist-read-private",
      "user-read-playback-state",
      "user-modify-playback-state",
      "streaming"
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: scopes.join(" "),
      code_challenge_method: "S256",
      code_challenge: challenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Handle OAuth Redirect Callback
  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      const verifier = localStorage.getItem("spotify_code_verifier");
      if (!verifier) return false;

      try {
        const body = new URLSearchParams({
          client_id: this.clientId,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.redirectUri,
          code_verifier: verifier
        });

        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
        });

        const data = await response.json();
        if (data.access_token) {
          this.setAccessToken(data.access_token, data.expires_in);
          if (data.refresh_token) {
            localStorage.setItem("spotify_refresh_token", data.refresh_token);
          }
          // Clean URL query string
          window.history.replaceState({}, document.title, window.location.pathname);
          return true;
        }
      } catch (err) {
        console.error("Spotify Authentication Error:", err);
      }
    }
    return false;
  }

  // Fetch API Helper
  async fetchSpotifyApi(endpoint, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated with Spotify API");
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Spotify API error");
    }

    return response.json();
  }

  // API Methods
  async getCurrentUserProfile() {
    return this.fetchSpotifyApi("/me");
  }

  async searchTracks(query) {
    if (!query) return [];
    const data = await this.fetchSpotifyApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=20`);
    return data.tracks.items.map(item => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map(a => a.name).join(", "),
      album: item.album.name,
      duration: Math.floor(item.duration_ms / 1000),
      cover: item.album.images[0]?.url || "https://via.placeholder.com/300",
      audioUrl: item.preview_url || null, // 30-sec preview or streamed via fallback audio engine
      spotifyUri: item.uri,
      genre: "Spotify Track",
      popular: item.popularity > 70
    }));
  }

  async getUserPlaylists() {
    const data = await this.fetchSpotifyApi("/me/playlists?limit=20");
    return data.items;
  }

  // Helper PKCE Crypto Utility Functions
  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  async generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
