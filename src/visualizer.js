// Dynamic Canvas Audio Spectrum & Waveform Visualizer

export class AudioVisualizer {
  constructor(canvasElement, audioEngine) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.audioEngine = audioEngine;
    this.animationId = null;
    this.isActive = false;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth || 300;
      this.canvas.height = parent.clientHeight || 180;
    }
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.render();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearCanvas();
  }

  clearCanvas() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render() {
    if (!this.isActive) return;

    this.animationId = requestAnimationFrame(() => this.render());

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    const analyser = this.audioEngine.analyser;
    
    // Draw default ambient wave if paused or no analyser yet
    if (!analyser || !this.audioEngine.isPlaying) {
      this.drawAmbientWave(width, height);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const barWidth = (width / bufferLength) * 2.2;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height * 0.85;

      // Dynamic Spotify Green & Cyber Gradient
      const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "rgba(29, 185, 84, 0.2)");
      gradient.addColorStop(0.5, "rgba(29, 185, 84, 0.8)");
      gradient.addColorStop(1, "#1ed760");

      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = "#1DB954";

      // Draw rounded bars
      const barY = height - barHeight;
      this.ctx.beginPath();
      this.ctx.roundRect(x, barY, Math.max(2, barWidth - 2), barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      x += barWidth + 2;
    }
  }

  drawAmbientWave(width, height) {
    const time = Date.now() * 0.002;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);

    for (let x = 0; x < width; x += 5) {
      const y = Math.sin(x * 0.02 + time) * 12 + (height / 2);
      this.ctx.lineTo(x, y);
    }

    this.ctx.strokeStyle = "rgba(29, 185, 84, 0.3)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
