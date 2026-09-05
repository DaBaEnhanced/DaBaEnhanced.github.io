// Menace - high score name entry, from $72094.
//
// A letter grid driven by the joystick, with fire to pick. The character is
// computed from the cursor, not looked up:
//
//   720fc  move.w d6,d0 / mulu.w #$a,d0   ; row * 10
//   72102  add.w d5,d0                    ; + column
//   72104  addi.w #$41,d0                 ; + 'A'
//
// so the grid is ten wide starting at 'A', and the three cells past 'Z' are
// controls rather than letters:
//
//   72108  cmp.w #$5c,d0 -> $7213e        ; '\' becomes a SPACE ($20)
//   72110  cmp.w #$5d,d0 -> $72146        ; ']' deletes
//   72118  cmp.w #$5e,d0 -> $7215c        ; '^' ends entry
//
// $72132 caps the name at ten characters and ends by itself. Fire is latched
// through $d(a5) exactly as the weapon trigger is, so one press is one letter.

// Implements $72094.
export const COLS = 10, ROWS = 3, FIRST = 0x41, MAX_LEN = 10;
export const SPACE = 0x5c, DELETE = 0x5d, END = 0x5e;

export function cellChar(col, row) {
  return row * COLS + col + FIRST;
}

export class NameEntry {
  constructor() {
    this.col = 0;
    this.row = 0;
    this.name = '';
    this.done = false;
    this.latch = false;      // $d(a5)
  }

  move(dx, dy) {
    // $7219c/$721b8 and $721d6/$721f0 reject movement at each edge; the
    // hardware pointer never wraps to the opposite side of the grid.
    this.col = Math.max(0, Math.min(COLS - 1, this.col + dx));
    this.row = Math.max(0, Math.min(ROWS - 1, this.row + dy));
  }

  // One frame. `fire` is the button state; the latch makes it one letter per
  // press rather than a stream.
  fire(down) {
    if (!down) { this.latch = false; return null; }
    if (this.latch) return null;
    this.latch = true;
    const c = cellChar(this.col, this.row);
    if (c === END) { this.done = true; return 'end'; }
    if (c === DELETE) {
      this.name = this.name.slice(0, -1);
      return 'delete';
    }
    if (this.name.length >= MAX_LEN) { this.done = true; return 'end'; }
    this.name += String.fromCharCode(c === SPACE ? 0x20 : c);
    if (this.name.length >= MAX_LEN) this.done = true;   // $72132
    return 'letter';
  }

  // $747c0 stores these exact character codes. The font slots for [ \\ ] ^
  // contain the game's own control artwork, so replacing them with improvised
  // ASCII symbols loses the original labels.
  label(col, row) {
    const c = cellChar(col, row);
    if (c > END) return ' ';
    return String.fromCharCode(c);
  }
}
