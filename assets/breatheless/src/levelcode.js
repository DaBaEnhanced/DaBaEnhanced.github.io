// Level passwords, from Sorgenti/Scores.asm (LevelCodeOut / LevelCodeIn /
// CheckAccessCode).
//
// A Breathless password is not a level number -- it is a complete save state
// packed into ten bytes, checksummed, XOR-encrypted and base-32 encoded as
// sixteen characters:
//
//   0    health            1    shields
//   2-3  energy (word)     4    (checksum << 1) | bit 16 of credits
//   5-6  credits, low word
//   7-8  word: bits 0..11  two bits per weapon (0 none, 1 owned, 2 boosted)
//                bits 13..15  the active weapon
//   9    (game << 4) | level
//
// The checksum is the byte sum of all ten with byte 4 holding only the credits
// bit, shifted left one; the spare low bit is where that credits bit lives.
// Encryption XORs the ten bytes with 0x65A4B52D repeating. The ASCII stage
// takes 5 bits at a time MSB-first and maps 0..31 to '1'..'9' then 'A'..'W'.

const KEY = [0x65, 0xa4, 0xb5, 0x2d];
const CODE_LEN = 16;

const packBytes = (st) => {
  const b = new Uint8Array(10);
  b[0] = st.health & 0xff;
  b[1] = st.shields & 0xff;
  b[2] = (st.energy >> 8) & 0xff;
  b[3] = st.energy & 0xff;
  const creditsHigh = (st.credits >> 16) & 1;
  b[4] = creditsHigh;
  b[5] = (st.credits >> 8) & 0xff;
  b[6] = st.credits & 0xff;
  let w = 0;
  for (let i = 0; i < 6; i++) w |= (st.weapons[i] & 3) << (2 * i);
  w |= (st.weapon & 7) << 13;
  b[7] = (w >> 8) & 0xff;
  b[8] = w & 0xff;
  b[9] = ((st.game & 0xf) << 4) | (st.level & 0xf);
  let sum = 0;
  for (const v of b) sum = (sum + v) & 0xff;
  b[4] = ((sum << 1) & 0xff) | creditsHigh;
  return b;
};

const crypt = (b) => {
  const out = new Uint8Array(b);
  for (let i = 0; i < 10; i++) out[i] ^= KEY[i % 4];
  return out;
};

const toAscii = (b) => {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    const bit = i * 5;
    // read 5 bits MSB-first across the byte array, as bfextu does
    let v = 0;
    for (let k = 0; k < 5; k++) {
      const n = bit + k;
      v = (v << 1) | ((b[n >> 3] >> (7 - (n & 7))) & 1);
    }
    let c = v + 49;
    if (c >= 58) c += 7;
    s += String.fromCharCode(c);
  }
  return s;
};

const fromAscii = (s) => {
  const b = new Uint8Array(10);
  for (let i = 0; i < CODE_LEN && i < s.length; i++) {
    const c = s.charCodeAt(i);
    const v = (c >= 65 ? c - 56 : c - 49) & 0x1f;
    for (let k = 0; k < 5; k++) {
      const n = i * 5 + k;
      if ((v >> (4 - k)) & 1) b[n >> 3] |= 0x80 >> (n & 7);
    }
  }
  return b;
};

export function encodeCode(state) {
  return toAscii(crypt(packBytes(state)));
}

export function decodeCode(code) {
  const s = String(code).toUpperCase().replace(/[^0-9A-W]/g, '');
  if (s.length !== CODE_LEN) return null;
  const b = crypt(fromAscii(s));
  const stored = b[4];
  const creditsHigh = stored & 1;
  const chk = Uint8Array.from(b);
  chk[4] = creditsHigh;
  let sum = 0;
  for (const v of chk) sum = (sum + v) & 0xff;
  if (((sum << 1) & 0xff) !== (stored ^ creditsHigh)) return null;  // CheckAccessCode

  const w = (b[7] << 8) | b[8];
  return {
    health: b[0], shields: b[1],
    energy: (b[2] << 8) | b[3],
    credits: (creditsHigh << 16) | (b[5] << 8) | b[6],
    weapons: [0, 1, 2, 3, 4, 5].map((i) => (w >> (2 * i)) & 3),
    weapon: (w >> 13) & 7,
    game: b[9] >> 4, level: b[9] & 0xf,
  };
}

/** The string ClearLevelCode writes when no valid code has been entered. */
export const PLACEHOLDER = '181CEIGGLJRJSE2T';

/** Build the code for a player standing at world `game`, level `level`. */
export function codeFor(player, game, level) {
  return encodeCode({
    health: player.health, shields: player.shields, energy: player.energy,
    credits: player.credits, weapons: player.weapons, weapon: player.weapon,
    game, level,
  });
}
