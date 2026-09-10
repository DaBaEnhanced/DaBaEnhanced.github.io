import { resolveAssetUrl } from "../../../shared/js/Assets.js";

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function videoDrawRect(videoWidth, videoHeight, targetWidth, targetHeight, fit = "contain") {
  if (fit === "stretch" || !(videoWidth > 0) || !(videoHeight > 0)) return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  const scale = fit === "cover" ? Math.max(targetWidth / videoWidth, targetHeight / videoHeight) : Math.min(targetWidth / videoWidth, targetHeight / videoHeight);
  const width = videoWidth * scale; const height = videoHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export class FMVSystem {
  constructor(game, { createVideo = () => document.createElement("video"), createAudioContext = () => { const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext; return Context ? new Context() : null; }, assetBase = new URL("../../", import.meta.url) } = {}) {
    this.game = game; this.createVideo = createVideo; this.createAudioContext = createAudioContext; this.audioContext = null; this.assetBase = assetBase; this.active = null;
  }

  unlockAudio() {
    const entry = this.active; if (!entry) return;
    if (entry.awaitingPlayback || entry.element.paused || entry.context?.state === "suspended") { entry.awaitingPlayback = false; this.startPlayback(entry); }
  }

  startPlayback(entry) {
    if (this.active !== entry) return;
    const resume = entry.context?.state === "suspended" ? entry.context.resume() : Promise.resolve();
    const playback = entry.element.play();
    Promise.all([Promise.resolve(resume), Promise.resolve(playback)]).catch((error) => { if (this.active !== entry) return; entry.awaitingPlayback = true; this.game.ui?.toast(`Click the game to enable FMV playback (${error.message})`); });
  }

  debugStatus() {
    const entry = this.active; if (!entry) return "FMV -"; const media = entry.element; const error = media.error ? ` ERR${media.error.code}` : ""; let level = "";
    if (entry.analyser) { const samples = new Uint8Array(entry.analyser.frequencyBinCount); entry.analyser.getByteTimeDomainData(samples); let peak = 0; for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128)); level = ` LVL${Math.round(peak / 128 * 100)}`; }
    return `FMV ${entry.id} AUDIO ${media.paused ? "PAUSED" : "PLAY"} T${(media.currentTime || 0).toFixed(1)} RS${media.readyState} VOL${Math.round(entry.volume * 100)}% CTX${entry.context?.state?.toUpperCase?.() ?? "NATIVE"}${level}${error}`;
  }

  connectAudio(entry) {
    try {
      this.audioContext ??= this.createAudioContext(); if (!this.audioContext) return;
      const sourceNode = this.audioContext.createMediaElementSource(entry.element); const analyser = this.audioContext.createAnalyser(); const gain = this.audioContext.createGain();
      analyser.fftSize = 256; gain.gain.value = entry.volume; sourceNode.connect(analyser).connect(gain).connect(this.audioContext.destination);
      entry.context = this.audioContext; entry.sourceNode = sourceNode; entry.analyser = analyser; entry.gainNode = gain; entry.element.volume = 1;
    } catch (error) { console.warn("FMV Web Audio routing unavailable; using native media audio.", error); }
  }

  play(id, options = {}) {
    const asset = this.game.project.videos?.get(id); if (!asset) throw new Error(`Missing FMV: ${id}`); if (!asset.src) throw new Error(`FMV '${id}' has no video source.`);
    this.stop(); const element = this.createVideo(); const volume = clamp(options.volume ?? asset.volume ?? 1); const source = resolveAssetUrl(asset.src, this.assetBase); element.src = source; element.preload = "auto"; element.playsInline = true; element.autoplay = true;
    // The same decoder supplies canvas frames and audio samples, guaranteeing synchronization.
    element.defaultMuted = false; element.muted = false; element.volume = volume; element.removeAttribute?.("muted"); element.setAttribute?.("aria-hidden", "true");
    // Keep the native video genuinely renderable: Chromium may throttle or silence display:none/transparent media.
    if (element.style) Object.assign(element.style, { position: "fixed", left: "-10000px", top: "0", width: "320px", height: "180px", opacity: "1", pointerEvents: "none" });
    if (element.nodeType && globalThis.document?.body && !element.isConnected) document.body.append(element);
    const previousInput = this.game.inputEnabled; this.game.inputEnabled = false;
    let resolveCompletion; let rejectCompletion; const completion = new Promise((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });
    const entry = { id, asset, element, volume, fit: options.fit ?? "contain", previousInput, resolveCompletion, rejectCompletion, awaitingPlayback: false };
    this.connectAudio(entry);
    const finish = (error) => { if (this.active !== entry) return; this.active = null; element.remove?.(); if (!this.game.inputEnabled) this.game.inputEnabled = previousInput; error ? rejectCompletion(error) : resolveCompletion(); };
    element.addEventListener("ended", () => finish(), { once: true }); element.addEventListener("error", () => finish(new Error(`Could not play FMV '${id}'.`)), { once: true }); this.active = entry;
    this.startPlayback(entry);
    return completion;
  }

  stop() { const entry = this.active; if (!entry) return; this.active = null; entry.element.pause(); entry.element.remove?.(); if (!this.game.inputEnabled) this.game.inputEnabled = entry.previousInput; entry.resolveCompletion(); }

  draw(ctx, width, height) {
    const entry = this.active; if (!entry) return; const video = entry.element;
    ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingEnabled = true;
    if (video.readyState >= 2) { const rect = videoDrawRect(video.videoWidth, video.videoHeight, width, height, entry.fit); ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height); }
    ctx.restore();
  }
}
