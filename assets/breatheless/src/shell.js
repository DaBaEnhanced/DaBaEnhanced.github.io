// The page around the game: fullscreen, and the small set of controls that
// stay visible while playing.
//
// Two modes. `index.html` is the development page and keeps its level picker,
// key legend and the diagnostic HUD. `play.html` is the one to actually play:
// nothing on screen but the game, a fullscreen button, sound, and cheats.
//
// The rule for what may appear in play mode is narrow on purpose. A frame
// counter, a cell coordinate and a list of internal audio states are useful
// while building the thing and are noise to everyone else, so `hud` is simply
// not written in play mode rather than being written and hidden.

const ICON = {
  full: 'M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4z',
  exit: 'M9 3v2H5v4H3V3h6zm12 0v6h-2V5h-4V3h6zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z',
  sound: 'M4 9v6h4l5 5V4L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
  mute: 'M4 9v6h4l5 5V4L8 9H4zm15.6 3l2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1z',
};

const svg = (path) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">` +
  `<path fill="currentColor" d="${path}"/></svg>`;

export class Shell {
  /**
   * @param {object} hooks
   *   playMode   true for play.html: no debug output anywhere
   *   onCheat    (kind) => void   'weapons' | 'health' | 'energy' | 'off'
   *   isCheat    (kind) => bool
   *   onSound    (on) => void
   *   isSound    () => bool
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.playMode = !!hooks.playMode;
    this.root = document.getElementById('shell');
    this.build();
    // A fullscreen change can come from the button or from Escape/F11, so the
    // button's label has to follow the browser rather than the click.
    document.addEventListener('fullscreenchange', () => this.sync());
  }

  build() {
    if (!this.root) return;
    // Append rather than replace: the bar may already hold a brand or anything
    // else the page put there, and blowing it away would take that with it.
    const holder = document.createElement('span');
    holder.style.cssText = 'display:flex;gap:6px;align-items:center;margin-left:auto';
    holder.innerHTML = `
      <button id="sh-snd" class="sh-btn" title="Sound"></button>
      <button id="sh-full" class="sh-btn" title="Fullscreen"></button>
      <div class="sh-sp"></div>
      <label class="sh-lbl" for="sh-cheat">CHEAT</label>
      <select id="sh-cheat" class="sh-sel" title="Cheats">
        <option value="">none</option>
        <option value="weapons">all weapons + refill</option>
        <option value="health">infinite health</option>
        <option value="energy">infinite energy</option>
        <option value="both">infinite health + energy</option>
      </select>`;
    this.root.append(holder);
    this.full = this.root.querySelector('#sh-full');
    this.snd = this.root.querySelector('#sh-snd');
    this.cheat = this.root.querySelector('#sh-cheat');

    this.full.addEventListener('click', () => this.toggleFullscreen());
    this.snd.addEventListener('click', () => {
      this.hooks.onSound?.(!this.hooks.isSound?.());
      this.sync();
    });
    this.cheat.addEventListener('change', () => {
      this.hooks.onCheat?.(this.cheat.value);
      // A one-shot grant should not sit in the box looking like a mode.
      if (this.cheat.value === 'weapons') this.cheat.value = '';
      // Give the keyboard back, or the next keypress goes to the select.
      document.getElementById('screen')?.focus();
    });
    // The selector should show what is actually on -- after a level change, a
    // reload of the page, or anything else that rebuilt the world.
    if (this.hooks.isCheat) this.cheat.value = this.hooks.isCheat() ?? '';
    this.sync();
  }

  get isFullscreen() { return document.fullscreenElement != null; }

  async toggleFullscreen() {
    try {
      if (this.isFullscreen) await document.exitFullscreen();
      else await (document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
                  ?? Promise.reject(new Error('unsupported')));
    } catch { /* denied or unsupported: the button just does nothing */ }
    this.sync();
  }

  sync() {
    if (!this.full) return;
    this.full.innerHTML = svg(this.isFullscreen ? ICON.exit : ICON.full);
    this.full.title = this.isFullscreen ? 'Leave fullscreen' : 'Fullscreen';
    const on = this.hooks.isSound?.() ?? true;
    this.snd.innerHTML = svg(on ? ICON.sound : ICON.mute);
    this.snd.title = on ? 'Sound on -- click to mute' : 'Sound off -- click to enable';
    // Highlighted while off, because "no sound" is the surprising state and the
    // button is the only way out of it.
    this.snd.classList.toggle('on', !on);
    document.body?.classList?.toggle('fs', this.isFullscreen);
    this.hooks.onLayout?.();
  }

  /** Called once audio exists, so the speaker icon starts out truthful. */
  refresh() { this.sync(); }
}
