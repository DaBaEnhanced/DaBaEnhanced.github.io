// Front-end flow, from Sorgenti/Presentation.asm.
//
// The presentation assets are named in BREATHLESS.GLD, in the order
// Presentation.asm declares its pointers: PresModName, PresPicName1..3,
// PresPicName4, GameOverPicName, EndGamePicName -- which resolves to
// MUST (title music), LOG1, LOG2, BTIT, CRED, GAOV, LAST.
//
// Sequence: on the first run the two logos show for 250 and 400 ticks (5s and
// 8s at 50Hz), then the title waits for a key. Afterwards the title is entered
// directly. Each level gets a loading screen showing its world picture, which
// the level itself names in `loadPic` (WLD1..WLD4).
//
// Pictures carry their own 256-colour palette and ShowPic loads it, so a screen
// swaps the display palette exactly as the original does.

import { fetchBytes } from './fetch.js';

export const SCREEN_W = 320, SCREEN_H = 240;   // SCREEN_WIDTH/HEIGHT in TMap.i
export const VIEW_H = 200;                     // the 3D window; the rest is panel

export const LOGO1_TICKS = 250;                // Waiting2 counts in 50Hz ticks
export const LOGO2_TICKS = 400;

export const STATE = {
  LOGO1: 'logo1', LOGO2: 'logo2', TITLE: 'title', CREDITS: 'credits',
  LOADING: 'loading', PLAYING: 'playing', GAMEOVER: 'gameOver', END: 'endGame',
};

export class Screens {
  constructor(assets) {
    this.assets = assets;
    this.pics = new Map();
    this.frame = new Uint8Array(SCREEN_W * SCREEN_H);
    this.palette = null;
  }

  async load(name) {
    if (this.pics.has(name)) return this.pics.get(name);
    const info = this.assets.manifest.pics[name];
    if (!info) return null;
    const [ind, pal] = await Promise.all([
      fetchBytes(`${this.assets.base}/${info.indices}`),
      fetchBytes(`${this.assets.base}/${info.palette}`),
    ]);
    const pic = { ...info, data: ind, pal };
    this.pics.set(name, pic);
    return pic;
  }

  /** Draw a picture at its stored position, clearing the rest to index 0. */
  draw(pic) {
    this.frame.fill(0);
    if (!pic) return;
    const { w, h, x, y, data } = pic;
    for (let row = 0; row < h; row++) {
      const dy = y + row;
      if (dy < 0 || dy >= SCREEN_H) continue;
      const src = row * w, dst = dy * SCREEN_W + x;
      for (let col = 0; col < w; col++) {
        const dx = x + col;
        if (dx < 0 || dx >= SCREEN_W) continue;
        this.frame[dst + col] = data[src + col];
      }
    }
    this.palette = pic.pal;
  }

  /** The pic's palette as RGBA, for the presenter. */
  paletteRGBA() {
    const src = this.palette;
    const out = new Uint8Array(1024);
    if (!src) return out;
    for (let i = 0; i < 256; i++) {
      out[i * 4] = src[i * 3];
      out[i * 4 + 1] = src[i * 3 + 1];
      out[i * 4 + 2] = src[i * 3 + 2];
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}
