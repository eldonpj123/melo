// Karaoke-style Synchronized Lyrics Engine

export class LyricsEngine {
  constructor(lyricsContainerElement) {
    this.container = lyricsContainerElement;
    this.currentLyrics = [];
    this.activeIndex = -1;
  }

  setLyrics(lyricsList) {
    this.currentLyrics = lyricsList || [];
    this.activeIndex = -1;
    this.render();
  }

  updateTime(currentTimeSeconds) {
    if (!this.currentLyrics || this.currentLyrics.length === 0) return;

    let newIndex = -1;
    for (let i = 0; i < this.currentLyrics.length; i++) {
      if (currentTimeSeconds >= this.currentLyrics[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== this.activeIndex) {
      this.activeIndex = newIndex;
      this.highlightLine();
    }
  }

  render() {
    if (!this.container) return;

    if (!this.currentLyrics || this.currentLyrics.length === 0) {
      this.container.innerHTML = `
        <div class="no-lyrics-state">
          <i class="fa-solid fa-microphone-slash">
          <p>No synchronized lyrics available for this track.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = this.currentLyrics.map((item, idx) => `
      <p class="lyric-line ${idx === this.activeIndex ? 'active' : ''}" data-idx="${idx}">
        ${item.text}
      </p>
    `).join("");
  }

  highlightLine() {
    if (!this.container) return;
    const lines = this.container.querySelectorAll(".lyric-line");

    lines.forEach((line, idx) => {
      if (idx === this.activeIndex) {
        line.classList.add("active");
        line.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        line.classList.remove("active");
      }
    });
  }
}
