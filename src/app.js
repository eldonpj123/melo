// Melo Main Application Controller & UI Binder
import { sampleTracks, samplePlaylists } from "./tracksData.js";
import { AudioEngine } from "./audioEngine.js";
import { SpotifyAPIClient } from "./spotify.js";
import { MusicService } from "./musicService.js";
import { AuthManager } from "./auth.js";
import { AudioVisualizer } from "./visualizer.js";
import { LyricsEngine } from "./lyricsEngine.js";

class SpotifyApp {
  constructor() {
    this.tracks = [...sampleTracks];
    this.playlists = JSON.parse(localStorage.getItem("user_playlists")) || [...samplePlaylists];
    this.accountLikedSongs = [];
    this.likedTrackIds = new Set();
    this.pendingLikeTrack = null;

    // Engines & Services
    this.audioEngine = new AudioEngine();
    this.spotifyClient = new SpotifyAPIClient();
    this.musicService = new MusicService();
    this.authManager = new AuthManager();
    this.visualizer = null;
    this.lyricsEngine = null;

    this.currentView = "home";
    this.activePlaylist = null;
    this.isScrubbing = false;
    this.showRemainingTime = false;

    this.init();
  }

  async init() {
    this.setupDOMElements();
    this.setupEngines();
    this.setupAuthUI();
    this.bindEvents();
    
    // Check Spotify OAuth callback
    await this.spotifyClient.handleCallback();
    this.updateSpotifyStatusUI();

    // Load liked songs from database for logged-in user
    const currentUser = this.authManager.getUser();
    if (currentUser && currentUser.email) {
      await this.loadLikedSongsForUser(currentUser);
    } else {
      this.accountLikedSongs = [];
      this.likedTrackIds.clear();
      this.updateLikedSongsCounter();
    }

    // Set initial queue
    this.audioEngine.setQueue(this.tracks);
    
    // Render initial views
    this.renderHomeView();
    this.renderPlaylistsSidebar();
    this.updateAdBlockerCounter(this.audioEngine.adsBlockedCount);

    // Auto load first track into player without autoplaying
    if (this.tracks.length > 0) {
      this.audioEngine.loadTrack(this.tracks[0], false);
    }

    // Load live trending hits in background
    this.musicService.getTrendingHits().then(hits => {
      if (hits && hits.length > 0) {
        hits.forEach(song => {
          if (!this.tracks.some(t => t.id === song.id)) {
            this.tracks.push(song);
          }
        });
        if (this.currentView === "home") {
          this.renderHomeView();
        }
      }
    }).catch(err => console.debug("Initial trending note:", err));
  }

  setupDOMElements() {
    // Nav & Views
    this.navButtons = document.querySelectorAll(".nav-item");
    this.views = document.querySelectorAll(".content-view");
    this.globalSearchInput = document.getElementById("global-search-input");
    this.globalSearchContainer = document.querySelector(".header-search-container");
    this.clearSearchBtn = document.getElementById("clear-search-btn");
    this.viewSearchInput = document.getElementById("view-search-input");
    this.viewSearchSubmitBtn = document.getElementById("view-search-submit-btn");

    // Player Elements
    this.playerTitle = document.getElementById("player-title");
    this.playerArtist = document.getElementById("player-artist");
    this.playerCover = document.getElementById("player-cover");
    this.btnPlayPause = document.getElementById("btn-play-pause");
    this.btnShuffle = document.getElementById("btn-shuffle");
    this.btnRepeat = document.getElementById("btn-repeat");
    this.btnPrev = document.getElementById("btn-prev");
    this.btnNext = document.getElementById("btn-next");
    this.btnMute = document.getElementById("btn-mute");
    this.volumeSlider = document.getElementById("volume-slider");
    this.progressFill = document.getElementById("progress-fill");
    this.progressWrapper = document.getElementById("progress-wrapper");
    this.seekTooltip = document.getElementById("seek-tooltip");
    this.progressScrubberDot = document.getElementById("progress-scrubber-dot");
    this.currentTimeLabel = document.getElementById("current-time");
    this.totalDurationLabel = document.getElementById("total-duration");
    this.playerHeartBtn = document.getElementById("player-heart-btn");
    this.mobileProgressFill = document.getElementById("mobile-progress-fill");
    this.trackTitleScroll = document.querySelector(".track-title-scroll");

    // Right Drawer & Currently Playing Track Elements
    this.rightDrawer = document.getElementById("right-drawer");
    this.drawerCover = document.getElementById("drawer-cover");
    this.drawerTitle = document.getElementById("drawer-track-title");
    this.drawerArtist = document.getElementById("drawer-track-artist");
    this.drawerHeartBtn = document.getElementById("drawer-heart-btn");
    this.drawerPlayPauseBtn = document.getElementById("drawer-play-pause-btn");
    this.drawerPrevBtn = document.getElementById("drawer-prev-btn");
    this.drawerNextBtn = document.getElementById("drawer-next-btn");
    this.drawerCoverWrapper = document.getElementById("drawer-cover-wrapper");
    this.playerThumbWrapper = document.getElementById("player-thumb-wrapper");
    this.drawerTabs = document.querySelectorAll(".drawer-tab");
    this.drawerPanels = document.querySelectorAll(".drawer-panel");

    // Drawer Timeline Elements
    this.drawerProgressWrapper = document.getElementById("drawer-progress-wrapper");
    this.drawerProgressFill = document.getElementById("drawer-progress-fill");
    this.drawerCurrentTimeLabel = document.getElementById("drawer-current-time");
    this.drawerTotalDurationLabel = document.getElementById("drawer-total-duration");
    this.drawerSeekTooltip = document.getElementById("drawer-seek-tooltip");

    // Mobile Navigation & Controls
    this.closeDrawerMobile = document.getElementById("close-drawer-mobile");
    this.mobileNowPlayingBtn = document.getElementById("mobile-now-playing-btn");
    this.mobileNavButtons = document.querySelectorAll(".mobile-nav-btn");

    // Modal & Switches
    this.settingsModal = document.getElementById("settings-modal");
    this.adBlockerToggle = document.getElementById("ad-blocker-toggle");
    this.adsBlockedCounter = document.getElementById("ads-blocked-counter");
  }

  setupEngines() {
    // Initialize Visualizer Canvas
    const canvas = document.getElementById("visualizer-canvas");
    this.visualizer = new AudioVisualizer(canvas, this.audioEngine);
    this.visualizer.start();

    // Initialize Karaoke Lyrics
    const lyricsContainer = document.getElementById("lyrics-container");
    this.lyricsEngine = new LyricsEngine(lyricsContainer);

    // Bind Audio Engine Listeners
    this.audioEngine.onTrackChange = (track) => this.onTrackChanged(track);
    this.audioEngine.onStateChange = (state) => this.onPlaybackStateChanged(state);
    this.audioEngine.onTimeUpdate = (timeData) => this.onTimeUpdated(timeData);
    this.audioEngine.onAdBlocked = (count) => this.updateAdBlockerCounter(count);
  }

  bindEvents() {
    // Navigation Routing
    this.navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const viewTarget = btn.getAttribute("data-view");
        if (viewTarget === "playlist") {
          this.openLikedSongsView();
        } else {
          this.switchView(viewTarget);
        }
      });
    });

    // Unified Search Synchronization & Handlers
    let searchDebounce = null;
    const triggerSearch = (query) => {
      const q = (query || "").trim();
      if (this.globalSearchInput) this.globalSearchInput.value = q;
      if (this.viewSearchInput) this.viewSearchInput.value = q;

      if (q.length > 0) {
        if (this.clearSearchBtn) this.clearSearchBtn.classList.remove("hidden");
        this.switchView("search");
        this.performSearch(q);
      } else {
        if (this.clearSearchBtn) this.clearSearchBtn.classList.add("hidden");
        this.renderSearchView();
      }
    };

    if (this.globalSearchContainer && this.globalSearchInput) {
      this.globalSearchContainer.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        this.globalSearchContainer.classList.add("search-active");
        this.globalSearchInput.focus();
      });
    }

    if (this.globalSearchInput) {
      this.globalSearchInput.addEventListener("input", (e) => {
        this.handleGlobalSearch(e.target.value);
      });
      this.globalSearchInput.addEventListener("blur", () => {
        if (!this.globalSearchInput.value.trim()) {
          this.globalSearchContainer?.classList.remove("search-active");
        }
      });

      this.globalSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(searchDebounce);
          triggerSearch(this.globalSearchInput.value);
        }
      });
    }

    if (this.viewSearchInput) {
      this.viewSearchInput.addEventListener("input", (e) => {
        clearTimeout(searchDebounce);
        const val = e.target.value;
        if (this.globalSearchInput) this.globalSearchInput.value = val;
        if (val.trim().length > 0) {
          if (this.clearSearchBtn) this.clearSearchBtn.classList.remove("hidden");
          searchDebounce = setTimeout(() => this.performSearch(val.trim()), 300);
        } else {
          if (this.clearSearchBtn) this.clearSearchBtn.classList.add("hidden");
          this.renderSearchView();
        }
      });

      this.viewSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(searchDebounce);
          triggerSearch(this.viewSearchInput.value);
        }
      });
    }

    if (this.viewSearchSubmitBtn) {
      this.viewSearchSubmitBtn.addEventListener("click", () => {
        const val = this.viewSearchInput?.value || this.globalSearchInput?.value || "";
        triggerSearch(val);
      });
    }

    // Clickable Trending Search Chips
    document.querySelectorAll(".chip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-query");
        if (q) {
          triggerSearch(q);
        }
      });
    });

    this.clearSearchBtn.addEventListener("click", () => {
      if (this.globalSearchInput) this.globalSearchInput.value = "";
      if (this.viewSearchInput) this.viewSearchInput.value = "";
      this.clearSearchBtn.classList.add("hidden");
      this.renderSearchView();
    });

    // Playback Button Events (Player Bar & Currently Playing Track)
    this.btnPlayPause.addEventListener("click", () => this.audioEngine.togglePlay());
    this.btnPrev.addEventListener("click", () => this.audioEngine.prevTrack());
    this.btnNext.addEventListener("click", () => this.audioEngine.nextTrack());
    this.btnShuffle.addEventListener("click", () => this.audioEngine.toggleShuffle());
    this.btnRepeat.addEventListener("click", () => this.audioEngine.toggleRepeat());

    if (this.drawerPlayPauseBtn) this.drawerPlayPauseBtn.addEventListener("click", () => this.audioEngine.togglePlay());
    if (this.drawerPrevBtn) this.drawerPrevBtn.addEventListener("click", () => this.audioEngine.prevTrack());
    if (this.drawerNextBtn) this.drawerNextBtn.addEventListener("click", () => this.audioEngine.nextTrack());
    if (this.drawerCoverWrapper) this.drawerCoverWrapper.addEventListener("click", () => this.audioEngine.togglePlay());
    if (this.playerThumbWrapper) this.playerThumbWrapper.addEventListener("click", () => this.audioEngine.togglePlay());

    // Volume Controls
    this.volumeSlider.addEventListener("input", (e) => {
      this.audioEngine.setVolume(parseFloat(e.target.value));
    });
    this.btnMute.addEventListener("click", () => this.audioEngine.toggleMute());

    // Interactive Spotify-Style Progress Scrubbing (Mouse & Touch)
    this.setupScrubberEvents(this.progressWrapper, this.progressFill, this.seekTooltip);
    if (this.drawerProgressWrapper) {
      this.setupScrubberEvents(this.drawerProgressWrapper, this.drawerProgressFill, this.drawerSeekTooltip);
    }

    // Toggle Remaining Time on Duration Click
    this.totalDurationLabel.addEventListener("click", () => this.toggleRemainingTime());
    if (this.drawerTotalDurationLabel) {
      this.drawerTotalDurationLabel.addEventListener("click", () => this.toggleRemainingTime());
    }

    // Mobile Bottom Navigation Routing
    this.mobileNavButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        if (view) {
          if (view === "playlist") {
            this.openLikedSongsView();
          } else {
            this.switchView(view);
          }
          this.mobileNavButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          if (this.rightDrawer) this.rightDrawer.classList.remove("mobile-expanded");
        }
      });
    });

    // Mobile Account Nav button
    document.getElementById("mobile-auth-nav-btn")?.addEventListener("click", () => {
      const user = this.authManager.getUser();
      if (user && user.email) {
        const dropdown = document.getElementById("user-profile-dropdown");
        dropdown?.classList.toggle("hidden");
      } else {
        this.openAuthModal("login");
      }
    });

    // Mobile Progress Line Tap / Drag Scrubbing
    const mobileProgressLine = document.getElementById("mobile-progress-line");
    if (mobileProgressLine && this.mobileProgressFill) {
      this.setupScrubberEvents(mobileProgressLine, this.mobileProgressFill, null);
    }

    // Mobile Floating Mini Player Expand/Collapse
    if (this.mobileNowPlayingBtn) {
      this.mobileNowPlayingBtn.addEventListener("click", () => {
        if (!this.rightDrawer) return;
        if (this.rightDrawer.classList.contains("mobile-expanded")) {
          this.rightDrawer.classList.remove("mobile-expanded");
        } else {
          this.rightDrawer.classList.remove("hidden");
          this.rightDrawer.classList.add("mobile-expanded");
          this.switchDrawerTab("info");
        }
      });
    }

    if (this.closeDrawerMobile) {
      this.closeDrawerMobile.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rightDrawer?.classList.remove("mobile-expanded");
      });
    }

    const playerBar = document.getElementById("player-bar");
    if (playerBar) {
      playerBar.addEventListener("click", (e) => {
        if (window.innerWidth <= 768) {
          // Don't expand if user tapped controls directly
          if (!e.target.closest("#btn-play-pause") && !e.target.closest("#player-heart-btn") && !e.target.closest("#mobile-progress-line") && !e.target.closest("#toggle-lyrics-btn")) {
            this.rightDrawer?.classList.remove("hidden");
            this.rightDrawer?.classList.add("mobile-expanded");
            this.switchDrawerTab("info");
          }
        }
      });
    }

    // Like Heart Button Events
    this.playerHeartBtn.addEventListener("click", () => this.toggleLikeCurrentTrack());
    this.drawerHeartBtn.addEventListener("click", () => this.toggleLikeCurrentTrack());
    document.getElementById("liked-songs-btn").addEventListener("click", () => this.openLikedSongsView());

    // Drawer Tabs & Drawer Toggle
    this.drawerTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const panelId = tab.getAttribute("data-panel");
        this.switchDrawerTab(panelId);
      });
    });

    document.getElementById("toggle-lyrics-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.switchDrawerTab("lyrics");
      if (this.rightDrawer) {
        this.rightDrawer.classList.remove("hidden");
        if (window.innerWidth <= 768) {
          this.rightDrawer.classList.add("mobile-expanded");
        }
      }
    });

    // Ad Blocker Toggle
    this.adBlockerToggle.addEventListener("change", (e) => {
      this.audioEngine.adBlockerEnabled = e.target.checked;
    });

    // User Profile Action
    document.getElementById("profile-menu-btn")?.addEventListener("click", () => {
      alert("Melo Music Player • 320kbps Ad-Free Streaming Engine Active");
    });

    // Create Playlist Button
    document.getElementById("create-playlist-btn").addEventListener("click", () => {
      const name = prompt("Enter new playlist name:");
      if (name) {
        const newPl = {
          id: `pl-${Date.now()}`,
          name: name,
          description: "Custom user playlist created in Spotify Ad-Free",
          cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
          trackIds: []
        };
        this.playlists.push(newPl);
        localStorage.setItem("user_playlists", JSON.stringify(this.playlists));
        this.renderPlaylistsSidebar();
      }
    });

    // Hero Controls & Turntable Deck
    document.getElementById("hero-play-btn")?.addEventListener("click", () => this.audioEngine.togglePlay());
    document.getElementById("hero-stage-toggle-btn")?.addEventListener("click", () => {
      if (this.rightDrawer) {
        this.rightDrawer.classList.remove("hidden");
        this.switchDrawerTab("lyrics");
      }
    });
    document.getElementById("billboard-cover-wrapper")?.addEventListener("click", () => this.audioEngine.togglePlay());
    document.getElementById("toggle-drawer-btn")?.addEventListener("click", () => {
      if (this.rightDrawer) {
        this.rightDrawer.classList.toggle("hidden");
      }
    });

    // Genre Cards Quick Click
    document.querySelectorAll(".genre-card").forEach(card => {
      card.addEventListener("click", () => {
        const genre = card.getAttribute("data-genre");
        this.globalSearchInput.value = genre;
        this.clearSearchBtn.classList.remove("hidden");
        this.switchView("search");
        this.performSearch(genre);
      });
    });
  }

  // --- VIEW ROUTING ---
  // --- VIEW ROUTING ---
  switchView(viewId) {
    this.currentView = viewId;
    this.views.forEach(v => v.classList.remove("active"));
    this.navButtons.forEach(b => b.classList.remove("active"));
    this.mobileNavButtons?.forEach(b => b.classList.remove("active"));

    const targetView = document.getElementById(`view-${viewId}`);
    const targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    const targetMobileNav = document.querySelector(`.mobile-nav-btn[data-view="${viewId}"]`);

    if (targetView) targetView.classList.add("active");
    if (targetNav) targetNav.classList.add("active");
    if (targetMobileNav) targetMobileNav.classList.add("active");

    if (viewId === "home") this.renderHomeView();
    if (viewId === "search") this.renderSearchView();
    if (viewId === "playlist") {
      if (!this.activePlaylist || this.activePlaylist.id === "liked-songs") {
        this.renderLikedSongsView();
      }
    }
  }

  switchDrawerTab(panelId) {
    this.drawerTabs.forEach(t => t.classList.remove("active"));
    this.drawerPanels.forEach(p => p.classList.remove("active"));

    const targetTab = document.querySelector(`.drawer-tab[data-panel="${panelId}"]`);
    const targetPanel = document.getElementById(`panel-${panelId}`);

    if (targetTab) targetTab.classList.add("active");
    if (targetPanel) targetPanel.classList.add("active");
  }

  // --- HOME VIEW RENDERER ---
  renderHomeView() {
    // Set dynamic greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("greeting-title").textContent = greeting;

    // Quick Play Grid
    const quickGrid = document.getElementById("quick-play-grid");
    quickGrid.innerHTML = this.tracks.slice(0, 6).map(track => `
      <div class="quick-card" data-track-id="${track.id}">
        <img src="${track.cover}" alt="${track.title}">
        <span>${track.title}</span>
        <button class="quick-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
    `).join("");

    quickGrid.querySelectorAll(".quick-card").forEach(card => {
      card.addEventListener("click", () => {
        const trId = card.getAttribute("data-track-id");
        const track = this.tracks.find(t => t.id === trId);
        if (track) this.audioEngine.loadTrack(track);
      });
    });

    // Made For You Cards
    const cardsCarousel = document.getElementById("made-for-you-cards");
    cardsCarousel.innerHTML = this.playlists.map(pl => `
      <div class="music-card" data-playlist-id="${pl.id}">
        <div class="card-art-wrapper">
          <img src="${pl.cover}" alt="${pl.name}">
          <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
        </div>
        <div class="card-title">${pl.name}</div>
        <div class="card-subtitle">${pl.description}</div>
      </div>
    `).join("");

    cardsCarousel.querySelectorAll(".music-card").forEach(card => {
      card.addEventListener("click", () => {
        const plId = card.getAttribute("data-playlist-id");
        this.openPlaylistView(plId);
      });
    });

    // Home Tracks Table
    this.renderTrackTable(this.tracks, "home-tracks-body");
  }

  // --- SEARCH VIEW RENDERER ---
  renderSearchView() {
    const searchContainer = document.getElementById("search-results");
    searchContainer.innerHTML = `
      <div class="shelf-section">
        <h3>Top Search Suggestions</h3>
        <p style="color: var(--text-sub); margin-top: 6px;">Type song titles, artists, or genres in the search bar above!</p>
      </div>
    `;
    this.renderTrackTable(this.tracks, null, searchContainer);
  }

  async performSearch(query) {
    const searchContainer = document.getElementById("search-results");
    const lowerQ = query.toLowerCase();

    // 1. Instant local search while network query runs
    const filteredLocal = this.tracks.filter(t => 
      t.title.toLowerCase().includes(lowerQ) || 
      t.artist.toLowerCase().includes(lowerQ) ||
      t.genre.toLowerCase().includes(lowerQ)
    );

    let html = `<h3>Search Results for "${query}"</h3>`;
    if (filteredLocal.length > 0) {
      this.renderTrackTable(filteredLocal, null, searchContainer, html);
    } else {
      searchContainer.innerHTML = `
        <div style="padding: 24px 0; text-align: center;">
          <div class="spinner" style="display: inline-block; width: 28px; height: 28px; border: 3px solid rgba(29, 185, 84, 0.2); border-top-color: var(--spotify-green); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
          <p style="color: var(--text-sub);">Searching studio 320kbps ad-free streams for <strong>"${query}"</strong>...</p>
        </div>
      `;
    }

    // 2. Query MusicService for direct 320kbps full stream songs
    try {
      const liveResults = await this.musicService.searchSongs(query);
      if (liveResults && liveResults.length > 0) {
        // Automatically register searched songs in tracks library
        liveResults.forEach(song => {
          if (!this.tracks.some(t => t.id === song.id)) {
            this.tracks.push(song);
          }
        });

        html = `
          <h3>Search Results for "${query}"</h3>
          <p style="color: var(--spotify-green); margin-bottom: 14px; font-weight: 500;">
            <i class="fa-solid fa-bolt"></i> ${liveResults.length} Full Songs Ready • 320kbps Ad-Free Studio Stream
          </p>
        `;
        const combined = [...liveResults, ...filteredLocal.filter(l => !liveResults.some(r => r.title.toLowerCase() === l.title.toLowerCase()))];
        this.renderTrackTable(combined, null, searchContainer, html);
        return;
      }
    } catch (err) {
      console.warn("MusicService search error:", err);
    }

    // 3. Fallback to Spotify API if authenticated
    if (this.spotifyClient.isAuthenticated()) {
      try {
        const spotifyResults = await this.spotifyClient.searchTracks(query);
        if (spotifyResults.length > 0) {
          html = `<h3>Search Results for "${query}"</h3><p style="color: var(--spotify-green); margin-bottom: 12px;"><i class="fa-brands fa-spotify"></i> Spotify API Results</p>`;
          const combined = [...filteredLocal, ...spotifyResults];
          this.renderTrackTable(combined, null, searchContainer, html);
          return;
        }
      } catch (err) {
        console.warn("Spotify API search fallback:", err);
      }
    }

    if (filteredLocal.length > 0) {
      this.renderTrackTable(filteredLocal, null, searchContainer, html);
    } else {
      searchContainer.innerHTML = `
        <h3>No matches found for "${query}"</h3>
        <p style="color: var(--text-sub); margin-top: 8px;">Try searching by song name (e.g., "Believer", "Blinding Lights") or artist (e.g., "Imagine Dragons", "The Weeknd").</p>
      `;
    }
  }

  // --- PLAYLIST VIEW ---
  openPlaylistView(playlistId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    this.activePlaylist = playlist;
    this.switchView("playlist");

    document.getElementById("playlist-detail-cover").src = playlist.cover;
    document.getElementById("playlist-detail-title").textContent = playlist.name;
    document.getElementById("playlist-detail-desc").textContent = playlist.description;
    document.getElementById("playlist-detail-count").textContent = `${playlist.trackIds.length} songs`;

    const playlistTracks = this.tracks.filter(t => playlist.trackIds.includes(t.id));
    this.renderTrackTable(playlistTracks, "playlist-tracks-body");

    document.getElementById("playlist-play-all-btn").onclick = () => {
      if (playlistTracks.length > 0) {
        this.audioEngine.setQueue(playlistTracks);
        this.audioEngine.loadTrack(playlistTracks[0]);
      }
    };
  }

  openLikedSongsView() {
    this.activePlaylist = { id: "liked-songs", name: "Liked Songs" };
    this.switchView("playlist");
    this.renderLikedSongsView();
  }

  // --- RENDER ACCOUNT LIKED SONGS VIEW ---
  renderLikedSongsView() {
    this.activePlaylist = { id: "liked-songs", name: "Liked Songs" };
    const user = this.authManager.getUser();
    const container = document.getElementById("playlist-tracks-body");
    const coverImg = document.getElementById("playlist-detail-cover");
    const titleEl = document.getElementById("playlist-detail-title");
    const descEl = document.getElementById("playlist-detail-desc");
    const countEl = document.getElementById("playlist-detail-count");
    const ownerEl = document.getElementById("playlist-detail-owner");
    const metaTag = document.getElementById("playlist-meta-tag");
    const playAllBtn = document.getElementById("playlist-play-all-btn");

    if (coverImg) {
      coverImg.src = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80";
    }
    if (titleEl) titleEl.textContent = "Liked Songs";
    if (metaTag) {
      metaTag.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="var(--accent-rose)" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>ACCOUNT CLOUD LIBRARY</span>';
    }

    if (user && user.email) {
      if (ownerEl) ownerEl.textContent = user.name || user.email;
      if (descEl) descEl.textContent = `Stored in database for ${user.email}. Synchronized across all your devices.`;
    } else {
      if (ownerEl) ownerEl.textContent = "Guest";
      if (descEl) descEl.textContent = "Log in to permanently store your liked songs in your personal database.";
    }

    // Build unique list of liked songs
    const combinedMap = new Map();
    (this.accountLikedSongs || []).forEach(t => {
      if (t && t.id) combinedMap.set(t.id, t);
    });
    this.tracks.forEach(t => {
      if (this.likedTrackIds.has(t.id) && !combinedMap.has(t.id)) {
        combinedMap.set(t.id, t);
      }
    });

    const likedTracks = Array.from(combinedMap.values());
    if (countEl) countEl.textContent = `${likedTracks.length} ${likedTracks.length === 1 ? 'song' : 'songs'}`;

    // Case 1: User is logged out
    if (!user || !user.email) {
      if (container) {
        container.innerHTML = `
          <div class="liked-empty-state">
            <div class="empty-icon-orb">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <h3>Sign in to see your Liked Songs</h3>
            <p>Your saved favorites are tied to your personal Melo account in the database. Log in or create an account to start building your collection.</p>
            <button class="btn-primary" id="liked-empty-login-btn" style="padding: 10px 24px; border-radius: 50px; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
              <span>Log In or Sign Up</span>
            </button>
          </div>
        `;
        document.getElementById("liked-empty-login-btn")?.addEventListener("click", () => {
          this.openAuthModal("login");
        });
      }
      if (playAllBtn) {
        playAllBtn.style.opacity = "0.5";
        playAllBtn.onclick = () => this.openAuthModal("login");
      }
      return;
    }

    // Case 2: User is logged in, but has 0 liked songs
    if (likedTracks.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="liked-empty-state">
            <div class="empty-icon-orb heart-orb">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--accent-rose)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </div>
            <h3>Songs you like will appear here</h3>
            <p>Save songs to your account by tapping the heart icon on any track while streaming in 320kbps lossless audio.</p>
            <button class="btn-pill" id="liked-empty-discover-btn" style="cursor: pointer;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
              <span>Discover Trending Songs</span>
            </button>
          </div>
        `;
        document.getElementById("liked-empty-discover-btn")?.addEventListener("click", () => {
          this.switchView("home");
        });
      }
      if (playAllBtn) {
        playAllBtn.style.opacity = "0.5";
        playAllBtn.onclick = null;
      }
      return;
    }

    // Case 3: User has liked songs
    if (playAllBtn) {
      playAllBtn.style.opacity = "1";
      playAllBtn.onclick = () => {
        if (likedTracks.length > 0) {
          this.audioEngine.setQueue(likedTracks);
          this.audioEngine.loadTrack(likedTracks[0]);
        }
      };
    }

    this.renderTrackTable(likedTracks, "playlist-tracks-body");
  }

  // --- SIDEBAR PLAYLISTS ---
  renderPlaylistsSidebar() {
    const listEl = document.getElementById("sidebar-playlists");
    listEl.innerHTML = this.playlists.map(pl => `
      <li class="playlist-item" data-id="${pl.id}">${pl.name}</li>
    `).join("");

    listEl.querySelectorAll(".playlist-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-id");
        this.openPlaylistView(id);
      });
    });
  }

  // --- BESPOKE AUDIO STRIPS RENDERER (LUXURY NON-SPOTIFY) ---
  renderTrackTable(trackList, targetBodyId = null, wrapperContainer = null, headingHtml = "") {
    const stripsHtml = trackList.map((track, idx) => {
      const isCurrent = this.audioEngine.currentTrack?.id === track.id;
      const isLiked = this.likedTrackIds.has(track.id);
      return `
        <div class="audio-strip track-row ${isCurrent ? 'playing' : ''}" data-track-id="${track.id}">
          <div class="strip-left">
            <div class="strip-index-orb">
              <span class="strip-num">${idx + 1}</span>
              <div class="strip-eq-anim">
                <span class="bar b1"></span>
                <span class="bar b2"></span>
                <span class="bar b3"></span>
              </div>
              <button class="strip-play-glyph"><i class="fa-solid fa-play"></i></button>
            </div>
            <div class="strip-art-frame">
              <img src="${track.cover}" alt="${track.title}" class="strip-cover" loading="lazy">
            </div>
            <div class="strip-info">
              <span class="strip-title">${track.title}</span>
              <span class="strip-artist">${track.artist}</span>
            </div>
          </div>
          <div class="strip-center">
            <span class="strip-album">${track.album || "Studio Master"}</span>
          </div>
          <div class="strip-right">
            <span class="strip-badge-lossless">${track.genre || "320K HD"}</span>
            <button class="strip-like-btn ${isLiked ? 'liked' : ''}" data-like-id="${track.id}" title="${isLiked ? 'Saved in Account Database' : 'Save to Liked Songs'}">
              <i class="${isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>
            </button>
            <span class="strip-duration">${this.formatTime(track.duration)}</span>
          </div>
        </div>
      `;
    }).join("");

    if (targetBodyId) {
      const el = document.getElementById(targetBodyId);
      if (el) {
        el.innerHTML = stripsHtml;
        this.bindTrackTableClickEvents(el, trackList);
      }
    } else if (wrapperContainer) {
      wrapperContainer.innerHTML = headingHtml + `
        <div class="audio-strips-wrapper">
          <div class="audio-strips-list">
            ${stripsHtml}
          </div>
        </div>
      `;
      this.bindTrackTableClickEvents(wrapperContainer, trackList);
    }
  }

  bindTrackTableClickEvents(container, trackList) {
    container.querySelectorAll(".track-row").forEach(row => {
      row.addEventListener("click", (e) => {
        // If clicked on like button directly, toggle like
        if (e.target.closest(".strip-like-btn")) {
          e.stopPropagation();
          const trId = row.getAttribute("data-track-id");
          const track = trackList.find(t => t.id === trId);
          if (track) this.toggleLikeTrackDirect(track);
          return;
        }

        const id = row.getAttribute("data-track-id");
        const track = trackList.find(t => t.id === id);
        if (track) {
          this.audioEngine.setQueue(trackList);
          this.audioEngine.loadTrack(track);
        }
      });
    });
  }

  // --- AUDIO ENGINE LISTENERS ---
  onTrackChanged(track) {
    if (!track) return;
    this.playerTitle.textContent = track.title;
    this.playerArtist.textContent = track.artist;
    this.playerCover.src = track.cover;

    this.drawerTitle.textContent = track.title;
    this.drawerArtist.textContent = track.artist;
    this.drawerCover.src = track.cover;

    // Sync Hero Billboard Showcase
    const heroTitle = document.getElementById("hero-song-title");
    const heroArtist = document.getElementById("hero-song-artist");
    const heroCover = document.getElementById("billboard-cover");
    const heroGenre = document.getElementById("hero-track-genre");
    if (heroTitle) heroTitle.textContent = track.title;
    if (heroArtist) heroArtist.textContent = track.artist + (track.album ? ` • ${track.album}` : "");
    if (heroCover) heroCover.src = track.cover;
    if (heroGenre) heroGenre.textContent = (track.genre || "Hi-Res Studio") + " • 320kbps Lossless";

    // Scrolling Marquee on Song Title
    if (this.trackTitleScroll) {
      this.trackTitleScroll.classList.add("is-scrolling");
    }

    this.lyricsEngine.setLyrics(track.lyrics || []);
    this.updateHeartIconUI();

    // Update active highlight on audio strips
    document.querySelectorAll(".track-row").forEach(row => {
      const id = row.getAttribute("data-track-id");
      if (id === track.id) {
        row.classList.add("playing");
      } else {
        row.classList.remove("playing");
      }
    });
  }

  onPlaybackStateChanged(state) {
    // Toggle vinyl turntable continuous spin animation
    document.body.classList.toggle("is-playing", state.isPlaying);

    const playSvg = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-left: 2px;">
        <polygon points="6,4 20,12 6,20"></polygon>
      </svg>
    `;
    const pauseSvg = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1"></rect>
        <rect x="14" y="4" width="4" height="16" rx="1"></rect>
      </svg>
    `;

    // Update play button icon across player bar and currently playing drawer card
    if (state.isPlaying) {
      this.btnPlayPause.innerHTML = pauseSvg;
      if (this.drawerPlayPauseBtn) this.drawerPlayPauseBtn.innerHTML = pauseSvg;
      
      const coverOverlay = document.getElementById("cover-overlay-btn");
      if (coverOverlay) coverOverlay.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
      
      const thumbOverlay = document.getElementById("thumb-overlay-btn");
      if (thumbOverlay) thumbOverlay.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
      
      const heroPlayBtn = document.getElementById("hero-play-btn");
      if (heroPlayBtn) {
        heroPlayBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
          <span>Pause Studio Master</span>
        `;
      }

      if (this.trackTitleScroll) this.trackTitleScroll.classList.add("is-scrolling");
    } else {
      this.btnPlayPause.innerHTML = playSvg;
      if (this.drawerPlayPauseBtn) this.drawerPlayPauseBtn.innerHTML = playSvg;

      const coverOverlay = document.getElementById("cover-overlay-btn");
      if (coverOverlay) coverOverlay.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" style="margin-left: 2px;"><polygon points="6,4 20,12 6,20"></polygon></svg>`;
      
      const thumbOverlay = document.getElementById("thumb-overlay-btn");
      if (thumbOverlay) thumbOverlay.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-left: 2px;"><polygon points="6,4 20,12 6,20"></polygon></svg>`;
      
      const heroPlayBtn = document.getElementById("hero-play-btn");
      if (heroPlayBtn) {
        heroPlayBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <polygon points="6,4 20,12 6,20"></polygon>
          </svg>
          <span>Play Studio Master</span>
        `;
      }

      if (this.trackTitleScroll) this.trackTitleScroll.classList.remove("is-scrolling");
    }

    // Toggle button active highlights
    this.btnShuffle.classList.toggle("active", state.isShuffle);
    this.btnRepeat.classList.toggle("active", state.isRepeat);

    // Mute icon
    if (state.isMuted || state.volume === 0) {
      this.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else {
      this.btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }

  // --- SCRUBBER CONTROLLER (SPOTIFY-STYLE DRAG & TOUCH SEEK) ---
  setupScrubberEvents(wrapper, fillEl, tooltipEl) {
    if (!wrapper) return;

    let isDragging = false;

    const calculatePercent = (clientX) => {
      const rect = wrapper.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(100, (x / rect.width) * 100));
    };

    const updateVisuals = (percent) => {
      if (fillEl) fillEl.style.width = `${percent}%`;
      if (this.progressFill) this.progressFill.style.width = `${percent}%`;
      if (this.drawerProgressFill) this.drawerProgressFill.style.width = `${percent}%`;
      if (this.mobileProgressFill) this.mobileProgressFill.style.width = `${percent}%`;

      const duration = this.audioEngine.audio.duration || 0;
      const targetTime = (percent / 100) * duration;

      if (tooltipEl) {
        tooltipEl.style.left = `${percent}%`;
        tooltipEl.textContent = this.formatTime(targetTime);
      }

      this.currentTimeLabel.textContent = this.formatTime(targetTime);
      if (this.drawerCurrentTimeLabel) {
        this.drawerCurrentTimeLabel.textContent = this.formatTime(targetTime);
      }
    };

    // Hover Tooltip tracking
    wrapper.addEventListener("mousemove", (e) => {
      if (!isDragging && tooltipEl) {
        const percent = calculatePercent(e.clientX);
        tooltipEl.style.left = `${percent}%`;
        const duration = this.audioEngine.audio.duration || 0;
        tooltipEl.textContent = this.formatTime((percent / 100) * duration);
      }
    });

    // Mouse Drag events
    wrapper.addEventListener("mousedown", (e) => {
      isDragging = true;
      this.isScrubbing = true;
      wrapper.classList.add("scrubbing");
      const percent = calculatePercent(e.clientX);
      updateVisuals(percent);

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const p = calculatePercent(moveEvent.clientX);
        updateVisuals(p);
      };

      const onMouseUp = (upEvent) => {
        if (!isDragging) return;
        isDragging = false;
        this.isScrubbing = false;
        wrapper.classList.remove("scrubbing");
        const finalPercent = calculatePercent(upEvent.clientX);
        this.audioEngine.seekToPercent(finalPercent);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    // Touch Drag events for mobile phones
    wrapper.addEventListener("touchstart", (e) => {
      isDragging = true;
      this.isScrubbing = true;
      wrapper.classList.add("scrubbing");
      const touch = e.touches[0];
      const percent = calculatePercent(touch.clientX);
      updateVisuals(percent);
    }, { passive: true });

    wrapper.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const percent = calculatePercent(touch.clientX);
      updateVisuals(percent);
    }, { passive: true });

    wrapper.addEventListener("touchend", (e) => {
      if (!isDragging) return;
      isDragging = false;
      this.isScrubbing = false;
      wrapper.classList.remove("scrubbing");
      const touch = e.changedTouches[0];
      const finalPercent = calculatePercent(touch.clientX);
      this.audioEngine.seekToPercent(finalPercent);
    });
  }

  toggleRemainingTime() {
    this.showRemainingTime = !this.showRemainingTime;
    const duration = this.audioEngine.audio.duration || 0;
    const currentTime = this.audioEngine.audio.currentTime || 0;
    this.updateDurationLabels(currentTime, duration);
  }

  updateDurationLabels(currentTime, duration) {
    let durationText = this.formatTime(duration);
    if (this.showRemainingTime && duration > 0) {
      const remaining = Math.max(0, duration - currentTime);
      durationText = `-${this.formatTime(remaining)}`;
    }

    this.totalDurationLabel.textContent = durationText;
    if (this.drawerTotalDurationLabel) {
      this.drawerTotalDurationLabel.textContent = durationText;
    }
  }

  onTimeUpdated(timeData) {
    if (this.isScrubbing) return;

    this.currentTimeLabel.textContent = this.formatTime(timeData.currentTime);
    this.updateDurationLabels(timeData.currentTime, timeData.duration);
    
    this.progressFill.style.width = `${timeData.progress}%`;

    // Sync mobile progress line & drawer timeline
    if (this.mobileProgressFill) {
      this.mobileProgressFill.style.width = `${timeData.progress}%`;
    }

    if (this.drawerProgressFill) {
      this.drawerProgressFill.style.width = `${timeData.progress}%`;
    }

    if (this.drawerCurrentTimeLabel) {
      this.drawerCurrentTimeLabel.textContent = this.formatTime(timeData.currentTime);
    }

    // Sync Karaoke Lyrics
    this.lyricsEngine.updateTime(timeData.currentTime);
  }

  async toggleLikeCurrentTrack() {
    if (!this.audioEngine.currentTrack) return;
    return this.toggleLikeTrackDirect(this.audioEngine.currentTrack);
  }

  async toggleLikeTrackDirect(track) {
    if (!track) return;
    const user = this.authManager.getUser();

    // Liked songs of the account must be stored in the database
    if (!user || !user.email) {
      this.pendingLikeTrack = track;
      this.openAuthModal("login");
      if (this.emailErrorMsg) {
        this.emailErrorMsg.textContent = "Please log in to save liked songs to your Melo account in the database.";
        this.emailErrorMsg.classList.remove("hidden");
        this.emailErrorMsg.style.display = "block";
      }
      return;
    }

    const cleanEmail = user.email.toLowerCase().trim();
    const trackId = String(track.id);

    if (this.likedTrackIds.has(trackId)) {
      // Remove from liked
      this.likedTrackIds.delete(trackId);
      this.accountLikedSongs = this.accountLikedSongs.filter(s => s.id !== trackId);
      this.updateHeartIconUI();
      this.updateLikedSongsCounter();

      if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
        this.renderLikedSongsView();
      }

      // Persist deletion to server database
      try {
        await fetch("/api/liked-songs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, trackId })
        });
      } catch (err) {
        console.warn("Failed to delete liked song from DB:", err);
      }
    } else {
      // Add to liked
      this.likedTrackIds.add(trackId);
      const trackObj = {
        id: track.id,
        title: track.title || "Track",
        artist: track.artist || "Artist",
        album: track.album || "Single",
        cover: track.cover || "",
        duration: track.duration || 180,
        audioUrl: track.audioUrl || track.streamUrl || "",
        genre: track.genre || "Music",
        likedAt: Date.now()
      };
      this.accountLikedSongs.unshift(trackObj);
      this.updateHeartIconUI();
      this.updateLikedSongsCounter();

      if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
        this.renderLikedSongsView();
      }

      this.showToastNotification("Added to Liked Songs", `"${track.title}" has been saved to your account in the database.`);

      // Persist addition to server database
      try {
        await fetch("/api/liked-songs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, track: trackObj })
        });
      } catch (err) {
        console.warn("Failed to save liked song to DB:", err);
      }
    }

    // Cache to account local storage
    localStorage.setItem(`liked_songs_${cleanEmail}`, JSON.stringify(this.accountLikedSongs));
    localStorage.setItem(`liked_track_ids_${cleanEmail}`, JSON.stringify(Array.from(this.likedTrackIds)));
  }

  async loadLikedSongsForUser(user) {
    if (!user || !user.email) {
      this.likedTrackIds.clear();
      this.accountLikedSongs = [];
      this.updateHeartIconUI();
      this.updateLikedSongsCounter();
      if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
        this.renderLikedSongsView();
      }
      return;
    }

    const cleanEmail = user.email.toLowerCase().trim();

    // 1. Immediately load synchronous local storage cache for this specific email
    const cachedSongs = JSON.parse(localStorage.getItem(`liked_songs_${cleanEmail}`) || "null");
    if (cachedSongs && Array.isArray(cachedSongs)) {
      this.accountLikedSongs = cachedSongs;
      this.likedTrackIds = new Set(cachedSongs.map(s => s.id));
      this.updateHeartIconUI();
      this.updateLikedSongsCounter();
      if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
        this.renderLikedSongsView();
      }
    }

    // 2. Query database for account's saved liked songs to synchronize with cloud
    try {
      const res = await fetch(`/api/liked-songs?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.likedSongs)) {
          this.accountLikedSongs = data.likedSongs;
          this.likedTrackIds = new Set(data.likedSongs.map(s => String(s.id)));
          localStorage.setItem(`liked_songs_${cleanEmail}`, JSON.stringify(this.accountLikedSongs));
          localStorage.setItem(`liked_track_ids_${cleanEmail}`, JSON.stringify(Array.from(this.likedTrackIds)));
          this.updateHeartIconUI();
          this.updateLikedSongsCounter();
          if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
            this.renderLikedSongsView();
          }
          if (this.currentView === "playlist" && this.activePlaylist?.id === "liked-songs") {
            this.renderTrackTable(this.accountLikedSongs, "playlist-tracks-body");
          }
          return;
        }
      }
    } catch (err) {
      console.debug("Database fetch liked songs error, using cache:", err);
    }
  }

  updateLikedSongsCounter() {
    const counterSpan = document.getElementById("auth-liked-count");
    if (counterSpan) {
      counterSpan.textContent = this.likedTrackIds.size;
    }
  }

  updateHeartIconUI() {
    const isLiked = this.audioEngine.currentTrack && this.likedTrackIds.has(this.audioEngine.currentTrack.id);
    if (isLiked) {
      this.playerHeartBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="var(--accent-rose)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
      if (this.drawerHeartBtn) {
        this.drawerHeartBtn.classList.add("liked");
        this.drawerHeartBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--accent-rose)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
      }
    } else {
      this.playerHeartBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
      if (this.drawerHeartBtn) {
        this.drawerHeartBtn.classList.remove("liked");
        this.drawerHeartBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
      }
    }

    // Sync all strip like buttons across the DOM with inline SVG
    document.querySelectorAll(".strip-like-btn").forEach(btn => {
      const id = btn.getAttribute("data-like-id");
      if (id && this.likedTrackIds.has(id)) {
        btn.classList.add("liked");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="var(--accent-rose)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
        btn.title = "Saved in Account Database";
      } else {
        btn.classList.remove("liked");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
        btn.title = "Save to Liked Songs";
      }
    });
  }

  updateAdBlockerCounter(count) {
    if (this.adsBlockedCounter) {
      this.adsBlockedCounter.textContent = count;
    }
  }

  updateSpotifyStatusUI() {
    const connBtnText = document.getElementById("spotify-conn-status");
    if (!connBtnText) return;
    if (this.spotifyClient.isAuthenticated()) {
      connBtnText.textContent = "Connected";
      const openBtn = document.getElementById("open-settings-btn");
      if (openBtn) openBtn.style.borderColor = "var(--spotify-green)";
    }
  }

  openSettingsModal() {
    if (!this.settingsModal) return;
    this.settingsModal.classList.remove("hidden");
  }

  closeSettingsModal() {
    if (!this.settingsModal) return;
    this.settingsModal.classList.add("hidden");
  }

  // ==========================================================================
  // AUTHENTICATION & LOGIN / SIGNUP UI CONTROLLER
  // ==========================================================================
  setupAuthUI() {
    this.authMode = "login";
    this.loginWithOtpOnly = false;
    this.authModal = document.getElementById("auth-modal");
    this.closeAuthModalBtn = document.getElementById("close-auth-modal-btn");
    this.authHeaderContainer = document.getElementById("auth-header-container");
    this.authEmailForm = document.getElementById("auth-email-form");
    this.authOtpForm = document.getElementById("auth-otp-form");
    this.authEmailInput = document.getElementById("auth-email-input");
    this.authPasswordInput = document.getElementById("auth-password-input");
    this.authPasswordGroup = document.getElementById("auth-password-group");
    this.authPasswordLabel = document.getElementById("auth-password-label");
    this.btnTogglePassword = document.getElementById("btn-toggle-password");
    this.passwordToggleIcon = document.getElementById("password-toggle-icon");
    this.passwordHintMsg = document.getElementById("password-hint-msg");
    this.btnOtpLoginToggle = document.getElementById("btn-otp-login-toggle");
    this.btnSendOtp = document.getElementById("btn-send-otp");
    this.btnSendOtpText = document.getElementById("btn-send-otp-text");
    this.btnSendOtpIcon = document.getElementById("btn-send-otp-icon");
    this.btnVerifyOtp = document.getElementById("btn-verify-otp");
    this.btnChangeEmail = document.getElementById("btn-change-email");
    this.btnResendOtp = document.getElementById("btn-resend-otp");
    this.resendCountdownSpan = document.getElementById("resend-countdown");
    this.emailErrorMsg = document.getElementById("email-error-msg");
    this.otpErrorMsg = document.getElementById("otp-error-msg");
    this.authTargetEmailLabel = document.getElementById("auth-target-email-label");
    this.otpDigitInputs = document.querySelectorAll(".otp-digit");
    this.stepEmail = document.getElementById("auth-step-email");
    this.stepOtp = document.getElementById("auth-step-otp");

    this.tabSignupBtn = document.getElementById("tab-signup-btn");
    this.tabLoginBtn = document.getElementById("tab-login-btn");
    this.authSwitchModeBtn = document.getElementById("auth-switch-mode-btn");
    this.authModalTitle = document.getElementById("auth-modal-title");
    this.authModalDesc = document.getElementById("auth-modal-desc");
    this.authSwitchPrompt = document.getElementById("auth-switch-prompt");

    // Mode tab triggers
    this.tabSignupBtn?.addEventListener("click", () => this.setAuthMode("signup"));
    this.tabLoginBtn?.addEventListener("click", () => this.setAuthMode("login"));
    this.authSwitchModeBtn?.addEventListener("click", () => {
      this.setAuthMode(this.authMode === "signup" ? "login" : "signup");
    });

    // Toggle password visibility (eye icon)
    this.btnTogglePassword?.addEventListener("click", () => {
      if (!this.authPasswordInput) return;
      const isPassword = this.authPasswordInput.type === "password";
      this.authPasswordInput.type = isPassword ? "text" : "password";
      if (this.passwordToggleIcon) {
        this.passwordToggleIcon.className = isPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
      }
    });

    // Toggle between password login and OTP login alternative
    this.btnOtpLoginToggle?.addEventListener("click", () => {
      this.loginWithOtpOnly = !this.loginWithOtpOnly;
      if (this.loginWithOtpOnly) {
        if (this.authPasswordGroup) this.authPasswordGroup.style.display = "none";
        if (this.btnOtpLoginToggle) this.btnOtpLoginToggle.textContent = "Log in with password instead";
        if (this.btnSendOtpText) this.btnSendOtpText.textContent = "Send Login Code";
        if (this.authModalDesc) this.authModalDesc.textContent = "Enter your email to receive a 6-digit login code via Gmail.";
      } else {
        if (this.authPasswordGroup) this.authPasswordGroup.style.display = "block";
        if (this.btnOtpLoginToggle) this.btnOtpLoginToggle.textContent = "Sign in with OTP instead";
        if (this.btnSendOtpText) this.btnSendOtpText.textContent = "Log in";
        if (this.authModalDesc) this.authModalDesc.textContent = "Enter your email and password to access your account.";
      }
    });

    // Listen for auth state changes
    this.authManager.onAuthStateChanged = (user) => {
      this.renderHeaderAuth(user);
    };

    // Initial Header Render
    this.renderHeaderAuth(this.authManager.getUser());

    // Modal Close Triggers
    this.closeAuthModalBtn?.addEventListener("click", () => this.closeAuthModal());
    this.authModal?.addEventListener("click", (e) => {
      if (e.target === this.authModal) this.closeAuthModal();
    });

    // Close on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.authModal?.classList.contains("hidden")) {
        this.closeAuthModal();
      }
    });

    // Main Login / Signup Form Submission
    this.authEmailForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = this.authEmailInput?.value.trim();
      const password = this.authPasswordInput?.value;

      if (!email) return;

      if (this.emailErrorMsg) {
        this.emailErrorMsg.classList.add("hidden");
        this.emailErrorMsg.style.display = "none";
        this.emailErrorMsg.textContent = "";
      }

      // CASE 1: LOG IN WITH PASSWORD
      if (this.authMode === "login" && !this.loginWithOtpOnly) {
        if (!password) {
          this.showEmailError("Please enter your password.");
          this.authPasswordInput?.focus();
          return;
        }

        this.setSubmitButtonLoading(true, "Logging in...");

        try {
          const result = await this.authManager.loginWithPassword(email, password);
          await this.loadLikedSongsForUser(result.user);
          if (this.pendingLikeTrack) {
            await this.toggleLikeTrackDirect(this.pendingLikeTrack);
            this.pendingLikeTrack = null;
          }
          this.closeAuthModal();
          this.showToastNotification(`Welcome back, ${result.user.name}!`, "Logged in successfully. Your liked songs are synchronized.");
          if (this.currentView === "playlist") this.renderLikedSongsView();
        } catch (err) {
          this.showEmailError(err.message || "Login failed. Please check your credentials.");
        } finally {
          this.setSubmitButtonLoading(false);
        }
        return;
      }

      // CASE 2: SIGN UP WITH PASSWORD + GMAIL OTP
      if (this.authMode === "signup") {
        if (!password || password.length < 6) {
          this.showEmailError("Password must be at least 6 characters.");
          this.authPasswordInput?.focus();
          return;
        }

        this.setSubmitButtonLoading(true, "Checking email...");

        try {
          if (await this.authManager.accountExists(email)) {
            throw new Error("An account with this email already exists. Please log in instead.");
          }
          this.setSubmitButtonLoading(true, "Sending code via Gmail...");
          await this.authManager.sendOtp(email, "signup", password);
          this.showOtpStep(email);
        } catch (err) {
          this.showEmailError(err.message || "Failed to send verification code.");
        } finally {
          this.setSubmitButtonLoading(false);
        }
        return;
      }

      // CASE 3: LOG IN WITH OTP (PASSWORDLESS)
      if (this.authMode === "login" && this.loginWithOtpOnly) {
        this.setSubmitButtonLoading(true, "Sending login code...");

        try {
          await this.authManager.sendOtp(email, "login", null);
          this.showOtpStep(email);
        } catch (err) {
          this.showEmailError(err.message || "Failed to send login code.");
        } finally {
          this.setSubmitButtonLoading(false);
        }
        return;
      }
    });

    // Step 2: Verify OTP Form
    this.authOtpForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.submitOtp();
    });

    // OTP Input Navigation without Auto-Fill (Manual Entry or User Paste)
    this.otpDigitInputs.forEach((input, index) => {
      input.addEventListener("keydown", (e) => {
        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          input.value = e.key;
          if (this.otpErrorMsg) this.otpErrorMsg.classList.add("hidden");

          if (index < this.otpDigitInputs.length - 1) {
            this.otpDigitInputs[index + 1].focus();
            this.otpDigitInputs[index + 1].select?.();
          } else {
            const fullCode = Array.from(this.otpDigitInputs).map(i => i.value).join("");
            if (fullCode.length === 6) {
              this.submitOtp();
            }
          }
        } else if (e.key === "Backspace") {
          e.preventDefault();
          if (input.value) {
            input.value = "";
          } else if (index > 0) {
            this.otpDigitInputs[index - 1].focus();
            this.otpDigitInputs[index - 1].value = "";
          }
        } else if (e.key === "ArrowLeft" && index > 0) {
          e.preventDefault();
          this.otpDigitInputs[index - 1].focus();
        } else if (e.key === "ArrowRight" && index < this.otpDigitInputs.length - 1) {
          e.preventDefault();
          this.otpDigitInputs[index + 1].focus();
        }
      });

      // Paste handler on any digit box
      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData("text").trim();
        const digits = pastedData.replace(/[^0-9]/g, "").slice(0, 6);
        if (digits) {
          digits.split("").forEach((d, i) => {
            if (this.otpDigitInputs[i]) {
              this.otpDigitInputs[i].value = d;
            }
          });
          const targetIndex = Math.min(digits.length, 5);
          this.otpDigitInputs[targetIndex].focus();
          if (digits.length === 6) {
            this.submitOtp();
          }
        }
      });
    });

    // Change email button
    this.btnChangeEmail?.addEventListener("click", () => {
      this.showEmailStep();
    });

    // Resend OTP button
    this.btnResendOtp?.addEventListener("click", async () => {
      if (this.btnResendOtp.disabled) return;
      try {
        this.btnResendOtp.disabled = true;
        this.btnResendOtp.textContent = "Sending...";
        await this.authManager.sendOtp(this.authManager.pendingEmail, this.authMode, this.authManager.pendingPassword);
        this.startResendTimer();
      } catch (err) {
        if (this.otpErrorMsg) {
          this.otpErrorMsg.textContent = err.message || "Failed to resend code.";
          this.otpErrorMsg.classList.remove("hidden");
        }
      }
    });
  }

  showEmailError(msg) {
    if (this.emailErrorMsg) {
      this.emailErrorMsg.textContent = msg;
      this.emailErrorMsg.classList.remove("hidden");
      this.emailErrorMsg.style.display = "block";
    }
  }

  setSubmitButtonLoading(isLoading, text = "") {
    if (!this.btnSendOtp) return;
    if (isLoading) {
      this.btnSendOtp.disabled = true;
      this.btnSendOtp.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${text}</span>`;
    } else {
      this.btnSendOtp.disabled = false;
      this.updateSubmitButtonText();
    }
  }

  setAuthMode(mode) {
    this.authMode = mode;
    this.loginWithOtpOnly = false;
    this.showEmailStep();

    if (this.authPasswordInput) {
      this.authPasswordInput.type = "password";
      this.authPasswordInput.value = "";
    }
    if (this.passwordToggleIcon) {
      this.passwordToggleIcon.className = "fa-regular fa-eye";
    }
    if (this.authPasswordGroup) {
      this.authPasswordGroup.style.display = "block";
    }

    if (mode === "signup") {
      this.tabSignupBtn?.classList.add("active");
      this.tabLoginBtn?.classList.remove("active");
      if (this.authModalTitle) this.authModalTitle.textContent = "Sign up for Melo";
      if (this.authModalDesc) this.authModalDesc.textContent = "Create an account with email and password to sync your library in database.";
      if (this.authPasswordLabel) this.authPasswordLabel.textContent = "Create Password";
      if (this.authPasswordInput) {
        this.authPasswordInput.placeholder = "At least 6 characters";
        this.authPasswordInput.setAttribute("autocomplete", "new-password");
      }
      if (this.passwordHintMsg) this.passwordHintMsg.style.display = "block";
      if (this.btnOtpLoginToggle) this.btnOtpLoginToggle.style.display = "none";
      if (this.btnSendOtpText) this.btnSendOtpText.textContent = "Continue & Verify with OTP";
      if (this.authSwitchPrompt) this.authSwitchPrompt.textContent = "Already have an account?";
      if (this.authSwitchModeBtn) this.authSwitchModeBtn.textContent = "Log in";
    } else {
      this.tabLoginBtn?.classList.add("active");
      this.tabSignupBtn?.classList.remove("active");
      if (this.authModalTitle) this.authModalTitle.textContent = "Log in to Melo";
      if (this.authModalDesc) this.authModalDesc.textContent = "Enter your email and password to access your account.";
      if (this.authPasswordLabel) this.authPasswordLabel.textContent = "Password";
      if (this.authPasswordInput) {
        this.authPasswordInput.placeholder = "Enter your password";
        this.authPasswordInput.setAttribute("autocomplete", "current-password");
      }
      if (this.passwordHintMsg) this.passwordHintMsg.style.display = "none";
      if (this.btnOtpLoginToggle) {
        this.btnOtpLoginToggle.style.display = "block";
        this.btnOtpLoginToggle.textContent = "Sign in with OTP instead";
      }
      if (this.btnSendOtpText) this.btnSendOtpText.textContent = "Log in";
      if (this.authSwitchPrompt) this.authSwitchPrompt.textContent = "Don't have an account?";
      if (this.authSwitchModeBtn) this.authSwitchModeBtn.textContent = "Sign up";
    }
  }

  updateSubmitButtonText() {
    if (!this.btnSendOtp) return;
    if (this.authMode === "signup") {
      this.btnSendOtp.innerHTML = `<span id="btn-send-otp-text">Continue & Verify with OTP</span><i class="fa-solid fa-arrow-right" id="btn-send-otp-icon"></i>`;
    } else if (this.loginWithOtpOnly) {
      this.btnSendOtp.innerHTML = `<span id="btn-send-otp-text">Send Login Code</span><i class="fa-solid fa-arrow-right" id="btn-send-otp-icon"></i>`;
    } else {
      this.btnSendOtp.innerHTML = `<span id="btn-send-otp-text">Log in</span><i class="fa-solid fa-arrow-right" id="btn-send-otp-icon"></i>`;
    }
  }

  async submitOtp() {
    const code = Array.from(this.otpDigitInputs).map(i => i.value.trim()).join("");
    if (code.length < 6) {
      if (this.otpErrorMsg) {
        this.otpErrorMsg.textContent = "Please enter all 6 digits.";
        this.otpErrorMsg.classList.remove("hidden");
        this.otpErrorMsg.style.display = "block";
      }
      return;
    }

    if (this.btnVerifyOtp) {
      this.btnVerifyOtp.disabled = true;
      this.btnVerifyOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Verifying...</span>';
    }
    if (this.otpErrorMsg) {
      this.otpErrorMsg.classList.add("hidden");
      this.otpErrorMsg.style.display = "none";
    }

    try {
      const user = await this.authManager.verifyOtp(code);
      await this.loadLikedSongsForUser(user);
      if (this.pendingLikeTrack) {
        await this.toggleLikeTrackDirect(this.pendingLikeTrack);
        this.pendingLikeTrack = null;
      }
      this.closeAuthModal();
      this.showToastNotification(`Welcome to Melo, ${user.name}!`, "Account verified and connected to database.");
      if (this.currentView === "playlist") this.renderLikedSongsView();
    } catch (err) {
      const otpContainer = document.querySelector(".otp-inputs-grid");
      if (otpContainer) {
        otpContainer.classList.remove("shake");
        void otpContainer.offsetWidth;
        otpContainer.classList.add("shake");
      }

      if (this.otpErrorMsg) {
        this.otpErrorMsg.textContent = err.message || "Verification failed.";
        this.otpErrorMsg.classList.remove("hidden");
        this.otpErrorMsg.style.display = "block";
      }
      this.otpDigitInputs[0]?.focus();
    } finally {
      if (this.btnVerifyOtp) {
        this.btnVerifyOtp.disabled = false;
        this.btnVerifyOtp.innerHTML = '<span>Verify & Enter Melo</span><i class="fa-solid fa-check"></i>';
      }
    }
  }

  showToastNotification(title, desc) {
    const toast = document.createElement("div");
    toast.className = "email-toast-banner visible";
    toast.style.cssText = "top: 20px; right: 20px; z-index: 1000; border-left: 4px solid #1DB954;";
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon" style="color: #1DB954;"><i class="fa-solid fa-circle-check"></i></div>
        <div class="toast-text">
          <div class="toast-title" style="color: #fff; font-weight: 700;">${title}</div>
          <div class="toast-desc" style="color: var(--text-sub); font-size: 0.82rem;">${desc}</div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  openAuthModal(mode = "login") {
    if (!this.authModal) return;
    this.setAuthMode(mode);
    this.authModal.classList.remove("hidden");
    this.showEmailStep();
    setTimeout(() => this.authEmailInput?.focus(), 100);
  }

  closeAuthModal() {
    if (!this.authModal) return;
    this.authModal.classList.add("hidden");
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.showEmailStep();
  }

  showEmailStep() {
    if (this.stepEmail) {
      this.stepEmail.classList.remove("hidden");
      this.stepEmail.style.display = "block";
    }
    if (this.stepOtp) {
      this.stepOtp.classList.add("hidden");
      this.stepOtp.style.display = "none";
    }
    if (this.emailErrorMsg) {
      this.emailErrorMsg.classList.add("hidden");
      this.emailErrorMsg.style.display = "none";
      this.emailErrorMsg.textContent = "";
    }
    if (this.otpErrorMsg) {
      this.otpErrorMsg.classList.add("hidden");
      this.otpErrorMsg.style.display = "none";
      this.otpErrorMsg.textContent = "";
    }
    this.otpDigitInputs.forEach(i => i.value = "");
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  showOtpStep(email) {
    if (this.stepEmail) {
      this.stepEmail.classList.add("hidden");
      this.stepEmail.style.display = "none";
    }
    if (this.stepOtp) {
      this.stepOtp.classList.remove("hidden");
      this.stepOtp.style.display = "block";
    }
    if (this.authTargetEmailLabel) this.authTargetEmailLabel.textContent = email;
    if (this.otpErrorMsg) {
      this.otpErrorMsg.classList.add("hidden");
      this.otpErrorMsg.style.display = "none";
      this.otpErrorMsg.textContent = "";
    }
    this.otpDigitInputs.forEach(i => i.value = "");
    setTimeout(() => this.otpDigitInputs[0]?.focus(), 150);
    this.startResendTimer();
  }

  startResendTimer() {
    if (this.resendInterval) clearInterval(this.resendInterval);
    let seconds = 45;
    if (this.btnResendOtp) this.btnResendOtp.disabled = true;
    if (this.resendCountdownSpan) this.resendCountdownSpan.textContent = seconds;

    this.resendInterval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(this.resendInterval);
        if (this.btnResendOtp) {
          this.btnResendOtp.disabled = false;
          this.btnResendOtp.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend code';
        }
      } else {
        if (this.btnResendOtp) {
          this.btnResendOtp.innerHTML = `Resend in <span id="resend-countdown">${seconds}</span>s`;
        }
      }
    }, 1000);
  }

  renderHeaderAuth(user) {
    if (!this.authHeaderContainer) return;

    if (user && user.email) {
      const displayName = user.name || user.email.split("@")[0];
      const initial = (user.initial || displayName.charAt(0)).toUpperCase();
      this.authHeaderContainer.innerHTML = `
        <div class="user-profile-badge" id="user-profile-trigger" title="${user.email}">
          <div class="user-avatar-circle">${initial}</div>
          <span class="user-name-label">${displayName}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-sub);"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="user-dropdown-menu hidden" id="user-profile-dropdown">
          <div class="user-dropdown-header">
            <div class="dropdown-email">${user.email}</div>
            <span class="dropdown-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>
              <span>Connected Account</span>
            </span>
          </div>
          <button class="user-dropdown-item" id="btn-auth-liked-songs">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--accent-cyan)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>Liked Songs (<span id="auth-liked-count">${this.likedTrackIds.size}</span>)</span>
          </button>
          <button class="user-dropdown-item logout-item" id="btn-auth-logout">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Log out</span>
          </button>
        </div>
      `;

      // Profile menu trigger
      const trigger = document.getElementById("user-profile-trigger");
      const dropdown = document.getElementById("user-profile-dropdown");
      
      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle("hidden");
      });

      // Click outside to close dropdown
      const closeDropdownHandler = (e) => {
        if (!dropdown?.contains(e.target) && !trigger?.contains(e.target)) {
          dropdown?.classList.add("hidden");
        }
      };
      document.removeEventListener("click", closeDropdownHandler);
      document.addEventListener("click", closeDropdownHandler);

      // Liked songs direct navigation
      document.getElementById("btn-auth-liked-songs")?.addEventListener("click", () => {
        dropdown?.classList.add("hidden");
        this.openLikedSongsView();
      });

      // Logout handler
      document.getElementById("btn-auth-logout")?.addEventListener("click", () => {
        dropdown?.classList.add("hidden");
        this.authManager.logout();
        this.loadLikedSongsForUser(null);
        const mobAuthLabel = document.getElementById("mobile-auth-nav-label");
        if (mobAuthLabel) mobAuthLabel.textContent = "Log In";
        this.showToastNotification("Logged out", "You have signed out of your account.");
      });
    } else {
      this.authHeaderContainer.innerHTML = `
        <button class="btn-signup-ghost" id="header-signup-btn">
          <span>Sign up</span>
        </button>
        <button class="btn-pill" id="header-login-btn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span>Log in</span>
        </button>
      `;

      const mobAuthLabel = document.getElementById("mobile-auth-nav-label");
      if (mobAuthLabel) mobAuthLabel.textContent = "Log In";

      document.getElementById("header-signup-btn")?.addEventListener("click", () => {
        this.openAuthModal("signup");
      });

      document.getElementById("header-login-btn")?.addEventListener("click", () => {
        this.openAuthModal("login");
      });
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.spotifyApp = new SpotifyApp();
});
