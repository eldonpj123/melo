// Advanced Web Audio Engine & Ad-Blocker Core Controller
// Manages playback stream, audio visualizer nodes, queue, ad-filtering pipeline

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";

    // Playback state
    this.currentTrack = null;
    this.queue = [];
    this.history = [];
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.8;
    this.isShuffle = false;
    this.isRepeat = false; // false = off, true = repeat current

    // Ad Blocker Pipeline Stats & Settings
    this.adBlockerEnabled = true;
    this.adsBlockedCount = parseInt(localStorage.getItem("ads_blocked_count") || "0");
    this.adDetectionKeywords = ["ad", "advertisement", "commercial", "spotify free ad", "sponsor", "promo"];

    // Web Audio API Context & Analyser Node for Visualizer
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.isAudioCtxInitialized = false;

    // Callbacks
    this.onTrackChange = null;
    this.onStateChange = null;
    this.onTimeUpdate = null;
    this.onAdBlocked = null;

    this.initListeners();
  }

  initListeners() {
    this.audio.volume = this.volume;

    this.audio.addEventListener("play", () => {
      this.isPlaying = true;
      this.notifyStateChange();
    });

    this.audio.addEventListener("pause", () => {
      this.isPlaying = false;
      this.notifyStateChange();
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate({
          currentTime: this.audio.currentTime,
          duration: this.audio.duration || 0,
          progress: this.audio.duration ? (this.audio.currentTime / this.audio.duration) * 100 : 0
        });
      }
    });

    this.audio.addEventListener("ended", () => {
      if (this.isRepeat) {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        this.nextTrack();
      }
    });

    this.audio.addEventListener("error", (e) => {
      console.warn("Audio playback error, attempting ad-block / audio stream fallback...", e);
      // If audio fails (e.g. ad link blocked or restricted URL), auto-skip cleanly
      this.handleAdFilterOrError();
    });
  }

  // Initialize Web Audio API for Canvas Visualizer (requires user gesture)
  initAudioContext() {
    if (this.isAudioCtxInitialized) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128; // 64 frequency bars

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.isAudioCtxInitialized = true;
    } catch (err) {
      console.warn("Web Audio API Visualizer init warning (audio may play fine):", err);
    }
  }

  // Check & Filter Ad tracks
  isAdTrack(track) {
    if (!track) return false;
    const titleLower = (track.title || "").toLowerCase();
    const artistLower = (track.artist || "").toLowerCase();
    
    // Check if title or artist matches known Spotify Free Ad patterns
    return this.adDetectionKeywords.some(kw => 
      titleLower.includes(kw) || artistLower.includes(kw) || track.isAd === true
    );
  }

  handleAdFilterOrError() {
    if (this.adBlockerEnabled) {
      this.adsBlockedCount++;
      localStorage.setItem("ads_blocked_count", this.adsBlockedCount);
      if (this.onAdBlocked) {
        this.onAdBlocked(this.adsBlockedCount);
      }
    }
    // Auto skip to next non-ad track
    this.nextTrack();
  }

  // Load and play track
  loadTrack(track, playImmediately = true) {
    if (!track) return;

    // Ad-Blocker Check
    if (this.adBlockerEnabled && this.isAdTrack(track)) {
      console.log(`[Ad-Blocker Active] Intercepted and blocked audio ad: "${track.title}"`);
      this.handleAdFilterOrError();
      return;
    }

    // Resume AudioContext if suspended
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    if (this.currentTrack) {
      this.history.push(this.currentTrack);
    }

    this.currentTrack = track;
    this.audio.src = track.audioUrl;
    this.audio.load();

    if (this.onTrackChange) {
      this.onTrackChange(this.currentTrack);
    }

    if (playImmediately) {
      this.play();
    }
  }

  play() {
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    
    if (this.audio.src) {
      this.audio.play().then(() => {
        this.isPlaying = true;
        this.notifyStateChange();
      }).catch(err => {
        console.warn("Autoplay / stream restriction:", err);
      });
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.notifyStateChange();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (!this.currentTrack && this.queue.length > 0) {
        this.loadTrack(this.queue[0]);
      } else {
        this.play();
      }
    }
  }

  nextTrack() {
    if (this.queue.length === 0) return;

    let nextIndex = 0;
    if (this.currentTrack) {
      const currentIndex = this.queue.findIndex(t => t.id === this.currentTrack.id);
      if (this.isShuffle) {
        nextIndex = Math.floor(Math.random() * this.queue.length);
      } else {
        nextIndex = (currentIndex + 1) % this.queue.length;
      }
    }

    this.loadTrack(this.queue[nextIndex]);
  }

  prevTrack() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (this.history.length > 0) {
      const prevTrack = this.history.pop();
      this.loadTrack(prevTrack);
    } else if (this.queue.length > 0) {
      const currentIndex = this.queue.findIndex(t => t.id === this.currentTrack?.id);
      const prevIndex = (currentIndex - 1 + this.queue.length) % this.queue.length;
      this.loadTrack(this.queue[prevIndex]);
    }
  }

  seekToPercent(percent) {
    if (this.audio.duration) {
      this.audio.currentTime = (percent / 100) * this.audio.duration;
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    this.audio.volume = this.volume;
    if (this.volume === 0) {
      this.isMuted = true;
    } else {
      this.isMuted = false;
    }
    this.notifyStateChange();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    this.notifyStateChange();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.notifyStateChange();
  }

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    this.notifyStateChange();
  }

  toggleAdBlocker() {
    this.adBlockerEnabled = !this.adBlockerEnabled;
    this.notifyStateChange();
    return this.adBlockerEnabled;
  }

  setQueue(tracks) {
    this.queue = tracks;
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isMuted: this.isMuted,
        volume: this.volume,
        isShuffle: this.isShuffle,
        isRepeat: this.isRepeat,
        adBlockerEnabled: this.adBlockerEnabled,
        adsBlockedCount: this.adsBlockedCount
      });
    }
  }
}
