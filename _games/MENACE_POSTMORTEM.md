---
layout: page
title: "Rebuilding Menace from a 1988 Amiga Disk"
categories: jekyll update
---

## A technical postmortem of an Amiga-to-HTML/JavaScript port

This is the second project of its kind, and it is best read alongside
`SAINTDRAGON_POSTMORTEM.md`. That document explains the Amiga, planar graphics,
MFM floppy encoding and 68000 assembly from first principles; this one assumes
you have either read it or are willing to use the glossary at the end. What is
worth reading here is what changed when the same method was pointed at an older,
simpler, and in some ways stranger game — and what the method still got wrong.

Menace is two years earlier than Saint Dragon: DMA Design, published by
Psyclapse in 1988, the first game by the studio that would later make Lemmings
and Grand Theft Auto. It is a horizontally scrolling shooter with six levels,
each ending in a large static guardian.

---

## Executive summary

We rebuilt the Amiga version of **Menace** as a browser game: a native
HTML/JavaScript implementation whose assets and behaviour were recovered from
the original disk and executable, not from screenshots and not by wrapping an
emulator.

| Recovered component | Result |
|---|---:|
| Disk sides decoded | 2 (496,000 + 489,800 bytes) |
| Resident program | 49,600 bytes at `$6f9e4`, stamped `Psygnosis 07/07/88` |
| Routines classified | 195 / 195 |
| Routines reachable from the main loop, cited in the port | 52 / 52 |
| Playable levels | 6 / 6 |
| Map columns recovered | 440, 508, 510, 512, 440, 508 |
| Path (wave) groups | 92 across six levels |
| Path VM opcodes implemented | 16 / 16 |
| Alien animation frames | 559 |
| Weapons | 5 |
| Music tracks | 3 |
| Sound effects | 19 / 19 reachable |
| Exported asset files | 59 binaries + 23 JSON |
| Browser engine | 5,324 lines across `index.html` and 16 modules |

The result includes the three intro screens, credits with difficulty selection,
the level index and its attract-mode demo, the mothership launch sequence, six
levels with dual-playfield parallax, five weapons, seven powerup types, the
guardian fight and its break-up, the HAM ending cutscene, the score tally,
high-score entry, and all audio.

The methodological rule inherited from the previous project held:

> Runtime pixels are useful evidence, but they are not a complete specification.
> Disk data and executable behavior must remain the source of truth.

This project added a second rule, learned the hard way and repeatedly:

> A table is a call site. Searching for immediate values finds the code that
> loads a constant and misses every dispatch that indexes an array — which is
> where the interesting behaviour tends to live.

And a third, which is really about instruments:

> Build the emulator to *measure*, not to look at. Then find out what it cannot
> measure, and write that down before trusting a number that came out of it.

---

## What was different this time

**The tools transferred unchanged.** `ipf.py`, `mfm.py`, `hunk.py`, `dis68k.py`,
`paula.py` and `serve.py` were copied from the Saint Dragon repository and ran
on Menace on day one without modification. Two games, two years apart, two
different publishers' loaders — and the floppy decoding, hunk parsing, 68000
disassembly and Paula audio model all carried over. That is the strongest single
argument for the "build instruments, not fixes" habit.

**The disk was not protected.** Saint Dragon was behind Rob Northen CopyLock and
most of its first phase went on getting past it. Menace's IPF reports ordinary
density on every real track, cylinder 0 side 0 is a standard AmigaDOS boot
track, and the rest uses one custom track format. The disk was open on day one.

**A published source listing existed — and could not be used.** Amiga Format
printed a version of the Menace source (`MENACE.S`). It is a 1990 listing of a
1988 game, and the difference matters more than it sounds. See Phase 2.

**The emulator became a measuring instrument.** In the Saint Dragon project the
partial emulator was mainly a way to see the original running. Here it was
extended with modes that dump the game's own data structures beside the frame
they produced, and it settled arguments that reading the disassembly could not.

---

## Phase 0: the disk, opened on day one

The boot block is a standard Psygnosis launcher: `AllocMem($2000, MEMF_CHIP)`,
`CMD_READ` of `$1200` bytes from offset `$400`, set `ExecBase.ColdCapture` to a
memory-clearing stub, recompute `ChkBase`, `jmp (a5)`.

The second-stage loader defines the disk format. It relocates itself before
doing anything — buffer offset `$ac` is copied to `$8002` and entered there — so
every address in it is a run address rather than a file offset, which makes a
first read of the loader confusing until you notice.

The resident program loads from cylinders 1–8 of side 0 to `$6f9e4`. That
address never appears as an immediate: it is *built on the stack* from two
pushed longs (`$6000` and `$f9e4`) recombined with `lsl.l #4` and `or.w`. A
search for the constant finds nothing. This is the same lesson as the tables,
arriving early and in a different costume.

---

## Phase 1: the resident program, and a label assigned by eye

The first report of Phase 0 said the entry point was `$50370`, read off the
bootstrap's closing `jmp $50370.l`.

That was wrong, and it is worth recording because it is *exactly* the failure
mode the previous postmortem named first — "labels assigned by eye became
facts" — reproduced by the same people who had written that lesson down.

The bootstrap enters the resident program at `$6f9e4` via `jsr (a5)`. That
routine immediately does `movea.l #$7fffe,a7` — it replaces the stack outright
and never returns — so the `jmp $50370.l` after it is unreachable. `$50370` is
in fact the first entry of the **sound driver's** jump table, called from five
sites with a tune selector in `d0`.

The plan for this project had been written to catch precisely this, and it did,
within a day. Writing the lesson down was not what saved it; having a checking
step that runs on every claim was.

---

## Phase 2: the published source that could not be transplanted

Amiga Format's `MENACE.S` listing offers what the previous project never had:
named routines, named fields, a documented globals structure. The temptation is
obvious.

The first test of it produced a negative result. `shift.coords` in the binary
reads the player's x from `$26(a5)`; the AF `rsreset` block puts `xpos` at +26
decimal. Twelve bytes apart. One field cannot distinguish "the whole structure
moved" from "it is a different structure", so the question needed a test that
could tell those apart.

Every `a5`-relative access in the binary carries an operand size, and every field
in the AF structure declares one. If the 1988 block were the 1990 block at a
constant shift, then at the correct shift *nearly every* access should land on a
field boundary of matching size. `tools/a5map.py` scores all 101 distinct
`(offset, size)` accesses against every shift from −64 to +128:

| Shift | Exact | On a field | Of 101 |
|---:|---:|---:|---:|
| +12 | 59 | 69 | 58.4% |
| +16 | 56 | 69 | 55.4% |
| +8 | 56 | 67 | 55.4% |
| +4 | 53 | 69 | 52.5% |

**No shift explains the accesses.** The best candidate leads the runner-up by
three out of 101, and roughly two thirds of accesses land on *some* field at
*any* shift purely because the structure is dense — 90 fields over 422 bytes,
one every 4.7 bytes. There is no signal.

So the listing's field offsets were banned outright, and matching was done at
routine level instead: use the names as hypotheses about *what a routine does*,
never as facts about *where a field lives*. Every offset in the port was earned
from the code that uses it.

This is the single best thing the project did. A plausible oracle arrived early,
a discriminating test was built before it was used, and the test said no.

---

## Phase 3: assets, and a display pipeline made of indices

Menace's art is 58 files of **palette indices** — one byte per pixel, colour
applied only at the very end. This is not an artefact of the export; it is how
the game works, and it shaped the whole port:

- Playfield 1 and playfield 2 are separate buffers with separate scroll rates.
- Colour arrives only in `toRGBA()`, through a 32-entry palette.
- The palette is *rewritten while the game runs*: each wave loads its own eight
  colours at `$71766`, the guardian loads eight more at `$70718`, the level
  effect walks one entry up and down to flash, and every screen transition
  fades.

One consequence took a long time to appreciate: **the background and the aliens
share colours 0–7.** A wave's palette is not "the aliens' colours", it is the low
half of the whole screen's palette — which is why every wave changes the look of
the level slightly, and why the powerup pod, whose artwork is colours 4–7, has to
be given the playfield to itself.

The intro's third screen resisted for a long time. Four plane counts, three
orderings, two interleaves and a dual-playfield reading were all scored against
it and all produced speckle. The answer was one register: `BPLCON0 = $6a00` sets
bit 11, `HOMOD`. It is **HAM6** — six planes where the low four bits are either a
palette index or a replacement for one component of the pixel to the left, and
bits 4–5 say which. Read as an indexed image it could never have worked.

---

## Phase 4: waves are a bytecode, not a table

The largest structural discovery of the project is that Menace's enemy waves are
not data-driven in the usual sense. They are **programs**.

A path group is up to twelve records. Each record is a 22-byte header followed
*inline* by its own script, and `$8(a0)` — the script pointer — is initialised to
`$16`, which is 22 decimal: the byte immediately after the header. The mover at
`$70acc` walks the twelve records and steps a two-byte instruction for each:

```
070c7c  addq.w #2,d0            ; step the script pointer
070c82  tst.w $0(a0,d0.w)       ; a zero word ends the record
070c86  beq $70d0a              ;   -> clear x.pos, the slot dies
070c8a  move.b $0(a0,d0.w),d4
070c90  andi.w #$f0,d4
070c94  cmp.w #$e0,d4           ; high nibble $E means an opcode
070c98  bne $70cec              ;   otherwise it is an (x,y) waypoint
070ca2  lea $70cac(pc),a2       ; sixteen handlers
070ca6  movea.l $0(a2,d3.w),a2
```

Sixteen opcodes: set pause, set speed, change sprite and animation, loop with a
counter, call and return, restart, reload coordinates, three flavours of seek,
and spawn. A record is a small coroutine with its own program counter, and a
group is twelve of them running in lockstep at 25 Hz.

Termination also carries information forward. At `$70d10`, bit 2 of the path
mode is inverted into byte `$16(a5)`. If the bit is clear, the byte becomes
non-zero and suppresses the bonus-pod launch at `$716cc`; if it is set, the pod
is eligible. Loading a new group clears the byte at `$717b6`. A zero script word
therefore does more than kill a record: it leaves a one-group latch controlling
whether that wave may be followed by a bonus. Treating all terminations as
equivalent preserved movement while quietly changing the reward cadence.

Two things about this are worth noticing. It is genuinely efficient — an entire
wave's choreography is a few dozen bytes. And it means there is no wave table to
read: recovering the waves meant implementing the interpreter, and the only way
to know it was right was to run it.

The hex/decimal trap in that first paragraph bit hard. `$16(a0)` is byte **22**,
not byte 16. Reading it as 16 corrupted the record's mode byte, which switched on
a movement mode that treats the script's absolute waypoints as relative deltas,
and sent one creature's shots to y 2800. The bug looked like a physics error and
was a base conversion.

---

## Phase 5: the emulator as a measuring instrument

`emu/` is a partial Amiga: 68000 core, custom-chip bus, blitter, and a video path
that renders the copper's bitplane fetches. It was built to watch the original
run. Its most valuable use turned out to be something else.

The port had a family of constants that positioned everything on screen —
`PF2_ORIGIN_X`, `SHIP_SPRITE_DX`, the guardian's `+8`. They had been *fitted*:
chosen so the guardian sat flush right, the eye sat in its socket, and the shot
limit killed a shot exactly at the screen edge. Three facts agreeing is
persuasive, and is not the same as a measurement.

So `emu/run.js` gained an `--anchor` mode: run the original's own code to a
chosen frame, then dump the twelve path records at `$34500` *beside the frame
they produced*, plus the copper list the game installed. The questions became
answerable:

```
vpos 10   BPLCON0 $6600  BPLCON1 $94  DDFSTRT $28  DIWSTRT $1f78  DIWSTOP $ffc6
vpos 223  BPLCON0 $4200  BPLCON1 $0   DDFSTRT $30
```

DIWSTRT h 120 against DIWSTOP h 454 is a **334-pixel window**, not the 320 the
fits had assumed. And the guardian frame gave the display constant outright: the
guardian's blit starts at frame column 96 with `$30` = 8, and its socket is a
stable hole at columns 262–278 — guardian-local 174, exactly the value that had
been fitted — so `96 + 8 − K = 64` gives K = 40, and every other position could
be read off rather than argued about.

**Knowing what the instrument cannot measure mattered as much.** The emulator
places sprites relative to `DIWSTRT` but draws bitplanes from the fetch origin,
and its collision loop compares them at the same column index. It can arbitrate
sprite-versus-hardware and bitplane-versus-bitplane, but *not*
sprite-versus-bitplane. Recognising that stopped a wrong conclusion: the ship
appears to sit ten pixels from where the port draws it, and that difference is
the emulator's own approximation rather than the port's error.

---

## Phase 6: collision, and being told we had it backwards

Denise, the display chip, reports collisions in one register, `CLXDAT`. Menace
masks it with `$46` and acts on three bits. Which bit means what was read out of
the hardware manual from memory, and the manual is genuinely ambiguous about
which playfield is "odd".

The player reported: on rookie, hitting *terrain* costs nothing and hitting
*aliens* costs shield; on expert, both do. The port had it the other way round.

The code settles it, and the mask itself is the clue. `$46` includes bits 1, 2
and 6 but excludes bit 5. Bits 1 and 2 are both sprite pairs against playfield 1
— the aliens. Bit 6 is only the *front* pair against playfield 2 — the terrain.
The ship's nose hits walls; the whole body hits enemies. That asymmetry is a
design decision visible only in a bitmask.

The outriders complicate that picture. `$7023a` merges each attached outrider
into the back hardware-sprite pair before Denise evaluates collisions. Drawing
the pods after testing only the base ship made their visible pixels harmless in
the browser. Collision has to include both attached pod masks even though ship
and pods are separate objects in the port.

The damage model behind it is unusual enough to state. `$62(a5)` is not a
counter, it is a 16-bit **shield bit field**. A hit shifts it right and the bit
shifted out decides whether the hit was absorbed, and the shift count grows with
the level:

```
6fd56  move.w $1a6(a5),d1   ; level
6fd5a  lsr.w #1,d1          ; halved
6fd6e  addq.w #5,d1         ;   aliens shift five more
6fd8e  addq.w #3,d1         ;   terrain shifts three more
```

A difficulty curve expressed as a shift count.

---

## Phase 7: the guardian, and a state that was never reached

Each level ends with a large static guardian that scrolls in a column at a time
and is fought by shooting an eye. Three state variables drive it: `$54(a5)` is
the scroll phase, `$10(a5)` is the fight machine, `$56(a5)` counts the sixteen
columns blitted.

Late in the project, chasing an unrelated question, the fight machine turned out
to have a branch nothing had implemented. `$717bc` runs *instead of* check.path
while `$10(a5)` is 1, counts `$6a(a5)` down, and on expiry explodes records 1
through 11 of the gate group — every projectile it has fired — leaving record 0,
the eye. `$6a(a5)` is written nowhere in the program: it comes from the globals
template and is never reloaded. It starts at 999, which at 25 Hz is forty
seconds, and it is a budget for the *whole game* rather than per level.

Then the part that reframed an earlier measurement. When those eleven finish,
`$71808` launches the next group and writes **`$ff`** to `$10(a5)`; the
dispatcher tests 0, 2 and 3 and falls through for `$ff`. That is exactly the
state the `--anchor 0 14000` capture had been sitting in — `$10` reading `$ff00`
as a word — for the entire time it was being used to measure the eye's position.
The measurement was still valid, but it had been taken inside a branch nobody
knew existed.

---

## Phase 8: audio

Three tunes and nineteen effects, captured by running the original in the
emulator and recording Paula's register writes, then replaying that stream
through a software Paula in the browser. Menace's driver plays effects two ways:
`$6ffe0` on one channel, and `$6fff0` on all four — the latter is four `jsr`
calls with the channel folded into the top byte of `d0`.

The subsystem produced the project's most instructive class of bug: the tune
*mapping* was correct and the tune *routing* was not, and no amount of
re-reading the mapping could have found it. That story is below.

Web Audio added an ownership problem that the original synchronous driver did
not have. Initialisation is now one shared promise, routing is decided from the
current screen only after that promise resolves, and music sources remain owned
until their fade really finishes so `stopAll()` can still stop them. Mute state
also has to be checked again after every wait. Without those rules, a delayed
load can start yesterday's tune on today's screen, or resurrect music after the
user has muted it.

---

## Phase 9: the browser engine

5,324 lines: `index.html` drives the loop and the screen flow, and sixteen modules
under `web/engine/` hold the path VM, damage, powerups, missiles, screens, score,
effects, the Paula model and the renderer. The renderer keeps playfield 1 and
playfield 2 as separate index buffers exactly as the hardware does, because
compositing them early throws away precisely the information collision needs: a
playfield-1 pixel underneath an opaque playfield-2 pixel is still there as far as
Denise is concerned.

Every non-obvious constant in that code carries the address it came from. That is
not decoration — `tools/coverage.py` reads the citations back and reports which
routines reachable from the main loop are not mentioned anywhere in the port. It
currently reports 52 of 52.

The screen flow needed the same fidelity as the combat. The original level index
is not a level picker: after 1,500 idle ticks it launches an invulnerable,
inputless level-one demonstration, fire returns to credits, and a separate
25 Hz timer ends the demo. F1 and F2 choose difficulty from credits and proceed
through the mothership; the browser's level selector remains explicitly a
developer aid rather than being folded into the recovered flow.

The main loop also taught a timing distinction that rates alone conceal. Aliens
and path movement run on one 25 Hz half of the 50 Hz loop; missiles, collision,
score consumption and level state run on the other. Running both groups on the
same half produced the right number of calls per second but the wrong ordering:
collision saw movement from the same instant instead of the intervening frame.

---

## The coolest discoveries

### 1. Waves are a bytecode interpreter

Covered above, and still the best thing in the binary. Twelve coroutines, a
sixteen-entry jump table, and a script stored inline in each record's own memory.

### 2. "Is anything alive?" is answered by ORing positions together

`$3c(a5)` gates the entire wave-spawning path: while it is non-zero, nothing new
appears. It is not a count and not a flag. The record walk clears it and then
does `or.w d1,$3c(a5)` with each live record's **x position**. Any record with a
non-zero x makes the word non-zero. It costs one instruction and no state.

The consequence is not obvious until you need it: the bonus pod is path group 0
and walks the same list, so while a pod is on screen the whole check is
suppressed and **no wave spawns**. The pod gets the playfield to itself. That is
also why its palette is stable — nothing loads another wave's eight colours over
it.

### 3. The globals template was the missing initialiser

`$7196c` copies a block at `$740ae` over the globals before every level. Four
words in it were never carried into the port, and three of them are behaviour:

```
a5+$4c  $000f   the FIRST wave delay - the reload is 10, the first is 15
a5+$6a  $03e7   the guardian gate timer, 999
a5+$60  $0000   the level index idle timeout, loaded with $5dc at $71b04
a5+$52  $0001   attract mode, on at boot
```

Values that are *only* ever read and decremented have no `move` to find them by.
They are invisible to a search for writes, and they are the reason the guardian
gate timer went unimplemented for the whole project.

### 4. The break-up sound is attached to drawing, not to dying

The guardian's death sequence is twelve explosions playing across its body, and
each one booms. Nothing in the path scripts plays a sound, nothing in the `$10`
2→3 transition does, and the records are sprite 4 — they are *spawned* as
explosions and never pass through the kill routine. The sound is in the **draw**
routine for sprite 4:

```
0709a2  tst.b  $5(a4) / bne    ; frame 0 only
0709aa  move.w $6e(a5),d0
0709ae  addi.w #$100,d0        ; step the channel
0709b2  andi.w #$300,d0        ; wrap 0..3
0709ba  ori.w  #$8a,d0 / jsr $6ffe0
```

It fires as each part is drawn on its first frame, on a rotating voice. Looking
for it anywhere in the death logic was looking in the wrong subsystem entirely.

### 5. A table is a call site

Five sound effects were reported for months as "packed but never requested". The
report was produced by scanning for `jsr $6ffe0` preceded by an immediate load
into `d0`, which is a perfectly good scan and answers a narrower question than
the one being asked. `$70328` does this instead:

```
070328  tst.w $3e(a5) / sne d1 / andi.w #$1,d1    ; cannons bar
070332  tst.w $40(a5) / sne d2 / andi.w #$2,d2    ; lasers bar
07033c  add.w d1,d0 / add.w d2,d0
070340  lea $7031e(pc),a0 / move.b $0(a0,d0.w),d0

$7031e:  16 15 03 07      none, cannons, lasers, both
```

Four of the five, in one four-byte table: the shot sound changes with which
weapon still has ammo. The fifth was in the high-score name entry. Sweeping the
whole program for *indexed reads* rather than immediates found every remaining
dispatch in one pass.

The call also occurs before ammunition is spent and before the game looks for a
free missile slot. The sound describes the attempted volley and the armed weapon
banks, not the missiles that were ultimately created. A full projectile pool can
therefore produce a shot sound without a new shot, which looks wrong if audio is
treated as a consequence of allocation rather than part of the input path.

### 6. Sprite slot 2 was filtered out by an address range

The per-level sprite table at `$78a3c` gives one art pointer per slot, and the
exporter kept only pointers landing inside the alien art block. Slots 1 and 2
point outside it, at shared banks — slot 1 is the bonus pod (exported separately,
so nothing was lost) and slot 2 is the heat-seeking mine the aliens fire.

Nothing drew it. Walking every path group of every level shows sprite 2 emitted
58 times on level 1 rising to 1,761 on level 6: most of what shoots at you was
invisible. The exporter had even identified the art two phases earlier —
`MINE = 0x6a9a8`, `MINE_FRAMES = 4`, annotated "fire.heatseeker: sprite 2" — and
that finding never crossed into the web pack.

The repair packed `mine.bin` and routed sprite 2 through it at both alien draw
sites, then exposed a second translation trap. Spawned projectile records can
carry `$80` in their hits byte, the generic "indestructible" marker. Applying
that rule literally to an active mine made every mine absorb player fire
forever. Mines are always shootable in the game, so visible sprite-2 records
must enter collision with an ordinary one-hit value. Template state and active
object semantics are not always interchangeable.

### 7. HAM6 in an intro screen

Covered above, and worth restating as a category: the answer was a single bit in
a register nobody had read, after four plane counts and three orderings had been
tried against the pixels.

### 8. Score is a mailbox, not an accumulator

The score at `$96(a5)` and the pending value at `$9a(a5)` are both four-byte
BCD numbers. Award sites use `move.l`, so two awards before `print.score` do not
add together: the later one replaces the pending value. The BCD addition happens
only when the 25 Hz score pass consumes that mailbox, adds it to the total and
the current level's tally, and clears it.

This matters for linked kills. The primary victim first writes 150 points on
rookie or 300 on expert, then any `kills.what` companion writes `$0750`; that
750 replaces the direct award rather than supplementing it. It also makes loop
phase part of scoring semantics: moving score consumption to a different half
of the scheduler can change which of two same-pass awards survives.

---

## What went well

**The instruments outlived the questions.** Programs written to answer one
question each ended up answering later ones nobody had thought of.
`tools/coverage.py` reads citations out of the JavaScript; `tools/semantics.py`
reports which routines the port *mentions* but whose effects it never names;
`web/selftest.mjs` runs the real engine headlessly; `tools/pagecheck.mjs` starts
the page against a stub DOM; `tools/routecheck.mjs` drives 8,000 frames of the
attract loop; `tools/podcheck.mjs` plays the game. The last of those was written
to settle one bug and immediately found two more.

**The emulator was extended rather than trusted.** When a question could not be
settled by reading, the answer was a new capture mode rather than a better
argument.

**Citations made the port auditable.** Because every constant carries the address
it came from, a machine can check whether the port has anything to say about a
given routine. "52 of 52" is a weak statement about correctness and a strong one
about coverage, and it is checkable on every build.

**The human feedback loop was the highest-value instrument in the project.** The
player had WinUAE and the original. Nearly every serious bug in the second half
of this document was found by someone playing the port, noticing something, and
saying so specifically enough to act on: "the shield decreases when hitting
aliens, not ground, 100% sure"; "the eye sits at the wrong position again"; "the
level is playing the interlude music, the status bar says tune 1". Each of those
is worth more than a week of re-reading disassembly.

**The status bar was a debugging surface.** Adding a live `tune N` readout to the
UI turned a subjective report ("the music changed") into a fact ("it is playing
tune 1"), and that fact located the bug in one step after two builds of failed
guessing.

---

## What was hard

**Hex offsets that must be read as decimal.** `$16(a0)` is byte 22. Every field
offset in the disassembly is hexadecimal and every array index in the port is
decimal, and the two look identical in a comment.

**One palette shared by everything.** Background, aliens, the pod and the
guardian all draw from the same 32 entries, and four different subsystems rewrite
parts of it at different rates. A palette bug never looks like a palette bug; it
looks like the wrong art.

**Several coordinate systems at once.** Path records live in their own space; the
ship is a hardware sprite positioned in colour clocks; playfield 2 objects are
addressed in a 92-byte row; the emulator's frame is fetch-relative. The powerup
pickup test compared `$26/$28` directly against a record's x and y — two
different spaces, 54 pixels apart — and the symptom was "I fly right over it and
nothing happens".

**Three tick rates, and phases within them.** 50 Hz for the ship, 25 Hz for
aliens and missiles in opposite branches of the main loop, and 12.5 Hz for
check.path behind `not.b $18(a5)`. A timer implemented at the wrong rate is off
by a factor of two and looks like a tuning problem. Two systems that run 25
times per second can still be wrong if they run in the same half rather than
alternating:
frequency is not scheduling.

**Timing that is gated on something else.** The alarm voice repeats on a ten-tick
timer, but `$72680` tests the driver's busy flag *before* touching the timer, so
the ten ticks are ten ticks of **silence**. Counting down regardless gives twice
as many repeats and reads as a tuning error rather than a structural one.

---

## What went badly, and why

### 1. Fitted constants were presented as derived

The screen-position constants were chosen to satisfy three observations at once,
and the comment recording that said "fitted". Later work read the surrounding
citations and treated them as measured. When the emulator finally measured the
real display window it was 334 pixels wide, not the 320 the fit had assumed.

The specific harm: a measured fact about the ship (`$26 + 8`, exact, from sprite
hardware) was generalised into a whole-scene shift, which moved the guardian ten
pixels and was rejected by the player in one look. The measurement was right and
the inference from it was wrong.

*Lesson: a fitted constant should be marked in a way that survives being quoted
— and a measurement of one object licenses nothing about another until the
relationship between them is also measured.*

### 2. A measurement that measured the wrong thing

To check the eye's position, a blob detector found connected regions of alien
pixels in the emulator's frame. It merged the eye with the sprite-2 records
sitting just below it and reported a 32-pixel-wide box, which produced a
confident, precise and completely wrong offset — and that wrong number was then
used to justify a change to every alien in the game.

The fix was to restrict the measurement to the display rows where the eye is the
only live record. The result then agreed with the port to the pixel.

*Lesson: when a measurement disagrees with a working system, suspect the
measurement first — and state what else was in the frame.*

### 3. "Nothing calls it" was true of a narrower question than the one asked

Described above under discovery 5. The claim was repeated in three separate
reports before it was tested properly.

*Lesson: when reporting a negative, state the search that produced it. "No call
site loads that value as an immediate" is honest; "nothing uses it" is not.*

### 4. Code that was complete and nothing drove

`nameentry.js` implements the high-score letter grid exactly: the ten-wide
arithmetic from `$720fc`, the space/delete/end cells, the ten-character cap. It
was correct, it was cited, it was reviewed — and nothing in the page ever called
`move()` or `fire()` on it. A qualifying score would have parked on that screen
forever.

The visible selector was missing too. It is not the menu arrow: the original
uses the 16×16 hardware sprite at `$7483a`, starts it at `(66,144)`, and moves it
on a 16-pixel grid over the name-entry cells. Recovering that bracket-shaped
sprite also made the otherwise obscure final cells — `[`, `\`, `]` and `^` —
read correctly on screen.

It was found by sweeping the engine for exported symbols and public methods that
appear nowhere else. That sweep takes ten lines of Python and should have existed
from the first week.

*Lesson: "implemented" and "reachable" are different properties and want
different checks.*

### 5. A draw that was immediately erased

Powerups were reported missing for four consecutive builds. Three separate real
bugs were found and fixed on the way — a missing drift waypoint, a spawn position
overwritten by live records, a palette reloaded on top of the pod — and the pod
still never appeared, because `drawFrames` wrote into the composited buffer and
`compose()` rebuilt that buffer from the two playfields ninety lines later. The
pod was drawn and wiped, every frame, for the whole time.

The reason it took so long is that every intermediate fix was *correct*. The
symptom never changed, so each fix looked like it had failed, when in fact it had
worked and been hidden by a later stage.

*Lesson: when a symptom does not move after a correct fix, stop fixing and
instrument the pipeline stage by stage. The question is not "is the state right"
but "does the state survive to the screen".*

### 6. Name shadowing, twice, in two languages

`Damage` had two methods called `refill`; the second silently replaced the first,
so weapon pods topped up the wrong bar. Later, a new `def explosion(img, man)`
was added to `pack_web.py` where one already existed — Python takes the last
definition, so the original stopped running and its manifest key vanished, which
would have crashed the death sequence.

Both were found by comparing output against expectation, not by reading. Neither
language warns.

*Lesson: in a file that grows to a thousand lines of similarly-shaped functions,
`grep -c "^def "` for duplicates is worth running.*

### 7. Edits that asserted before they wrote

Three times, a Python script performed several edits, hit a failed assertion
partway, and exited having already written some of them. The result was a file in
a state nobody had designed: a comment explaining a function that was no longer
there, an `arm()` that was documented and absent. One of those took a full
debugging session to find, because the code *read* correctly.

*Lesson adopted: after any scripted multi-edit, grep the file for the NEW state.
An exit code of zero says the script finished, not that the file is what you
meant.*

### 8. Asynchronous guards that defeat themselves

The alarm voice was supposed to refuse to retrigger while still sounding. The
first implementation claimed the slot, then `await`ed the audio buffer to measure
the sample, and **cleared the claim if the load rejected** — so every firing of
the timer slipped past while the first was still loading. Measured: twelve
firings, twelve plays. The rewrite takes the guard synchronously and has no path
that releases it early. Twelve firings, four plays.

A sibling bug: playing an effect "on all four channels" was implemented as four
independent asynchronous loads, which start milliseconds apart and phase against
each other. Four Amiga channels carrying the same sample are *one sound at four
times the level*; four Web Audio sources are a stutter.

*Lesson: a mutual-exclusion guard must be taken before the first `await`, and
"the hardware does it four times" does not mean "do it four times".*

The same rule grew beyond the alarm. A promise that began under one screen or
mute state must revalidate that intent when it resumes, and an object that is
fading still needs an owner until it has actually stopped. Asynchronous work is
part of the state machine, not an implementation detail outside it.

### 9. A fix applied one layer too broadly

Sound effects were being truncated because the renderer stopped at the last
register write, while real Paula keeps playing after the driver stops writing.
The fix — keep rendering past the end — was correct for one-shots and wrong for
tunes, whose logs end where the tune ends. It appended whatever note was last
sounding, and because tunes loop, that stray note came back every time round. The
player heard it as a hang and a mid-level music change.

*Lesson: when a fix is about the difference between two kinds of thing, apply it
to the kind, not to the shared code path.*

### 10. A test exercised an implementation the game did not use

`LevelState` had a convincing isolated test for kill notification, guardian
entry and completion. The page meanwhile maintained a separate `m10` state
machine, so the tested class was not the object deciding any of those things in
production. The test was green while normal play could never satisfy
`complete()`, and status reporting could not reliably identify the guardian.

The repair removed the duplicate state and made the page use `LevelState`
directly. The same audit added a lifecycle route test because fresh-start,
death, tally and restart state are ownership boundaries too: a new run must not
inherit pending score or half-dead gameplay state from the last one.

*Lesson: tests prove properties of the code they execute. They do not prove that
production owns, reaches or even imports that code.*

### 11. Right tool, wrong architecture

The HD pipeline from the previous project was ported over: slice, upscale, repack.
It worked, and the output rendered a full 4× frame correctly. It was then removed.

Saint Dragon keeps one RGBA atlas, so upscaling is an image problem. Menace's art
is palette indices and the palette is live, so any upscaler that could add real
detail must output RGB, and there is no way back to an index without destroying
the thing the palette work depends on. A palette-safe scaler (Scale2x, which
copies rather than blends) keeps the pipeline correct but can only ever smooth
edges. Real HD means one fixed sprite copy per palette — a renderer rework, not
an asset pipeline.

The reversal was done with a byte-comparison: the 1× render was captured before
the revert and compared after. Identical.

*Lesson: port the tool only after checking that the assumption underneath it
transferred too. And when reverting a large mechanical change with no version
control, make the revert provable.*

---

## The validation strategy that emerged

Seven layers, each cheap enough to run on every build except the last.

**Layer 1 — format invariants.** Frame counts divide evenly into file sizes;
every asset's geometry is derived from the manifest rather than hardcoded.

**Layer 2 — static cross-checks.** `tools/coverage.py` reports routines reachable
from the main loop with no citation in the port. `tools/semantics.py` reports
routines the port cites but whose globals and constants it never mentions — it
was the semantic pass that surfaced the guardian gate timer.

**Layer 3 — isolated behaviour.** `web/selftest.mjs` runs the real engine modules
headlessly: the path VM over every group, the level state, damage, the bonus pod
and weapon banks. Focused companions assert scoring overwrite rules, scheduler
cadence and suspension bounds, audio routing and asynchronous ownership, asset
load completion, and pixel-level gameplay invariants. These tests fail on a
wrong result; they no longer rely on a plausible-looking diagnostic dump.

**Layer 4 — the page starts.** `tools/pagecheck.mjs` executes `index.html`'s
module body against a stub DOM and fires every bound key. It catches import
errors and undefined references that a browser would only reveal on the screen
where they happen.

**Layer 5 — the route runs.** `tools/routecheck.mjs` drives 8,000 frames through
the attract loop with a synthetic clock and asserts the recovered order from the
three intros through credits, legend, index, mothership and game, then back to
credits. It was written after a `ReferenceError` on the legend screen that
`pagecheck` could not see, because the fault was 1,295 frames into a state
machine.

**Layer 6 — the game plays.** `tools/podcheck.mjs` and `dangercheck.mjs` drive
ordinary waves and the guardian route, patching the real `PathVM` and `Bonus`
prototypes to assert that groups advance, kills occur and eligible pods reach the
renderer. `lifecyclecheck.mjs` proves that fresh games reset score and that death,
tally and restart wait for confirmation instead of dropping back into live play.
Because ES modules are singletons, these checks instrument the page's own
objects rather than a copy.

**Layer 7, which cannot be automated — a person plays it against the original.**
Every layer above says the machine did what the code says. Only this one says the
code says the right thing.

---

## Tools produced by the project

| Tool | What it does |
|---|---|
| `tools/ipf.py`, `mfm.py`, `trackfmt.py`, `mkmfm.py` | floppy image decoding (inherited, unmodified) |
| `tools/decode_disk.py`, `diskmap.py` | reconstruct the two disk sides |
| `tools/hunk.py`, `dis68k.py` | executable parsing and 68000 disassembly (inherited) |
| `tools/census.py` | enumerate and classify every routine |
| `tools/coverage.py` | citation coverage of the port against the binary |
| `tools/semantics.py` | which cited routines have effects the port never names |
| `tools/a5map.py` | the discriminating test that rejected the AF structure |
| `tools/afsyms.py`, `match.py` | seed and match against the published listing |
| `tools/export_gfx.py`, `export_sprites.py`, `export_screens.py`, `export_text.py`, `export_mothership.py` | asset recovery |
| `tools/levelmap.py`, `loadmap.py`, `paths.py` | level maps and path groups |
| `tools/paula.py`, `render_sounds.py`, `audio_check.py` | audio capture and rendering |
| `tools/pack_web.py` | build `web/assets/` |
| `tools/bump.py` | defeat ES module caching during development |
| `tools/serve.py` | local HTTP, because `fetch` will not read `file://` |
| `emu/` | partial Amiga: CPU, bus, blitter, video, plus `--anchor`, `--collide`, `--scroll` capture modes |
| `web/selftest.mjs`, `gameplaytest.mjs`, `scoretest.mjs`, `timingtest.mjs`, `audiotest.mjs`, `loadtest.mjs` | asserted engine and integration invariants |
| `tools/pagecheck.mjs`, `routecheck.mjs`, `podcheck.mjs`, `dangercheck.mjs`, `lifecyclecheck.mjs` | page, route and live-game validation |
| `tools/hd/` | HD asset pipeline — **parked**, with the reasoning kept |

---

## How AI assistance helped, and where it did not

**Helped.** Reading 195 routines of unlabelled 68000 and proposing what each one
does. Writing instruments — the validation programs are mostly mechanical and
were written quickly. Holding a large number of half-facts in view at once while
chasing a bug across the disassembly, the exporter, the engine and the page.
Producing the citation comments that made coverage checkable at all.

**Did not help, and actively hurt.** Confident synthesis from memory: the
collision bits were stated from a remembered reading of the hardware manual and
were backwards. Plausible-sounding negatives: "nothing calls it" was asserted
three times from a search that could not have found the answer. Over-generalising
a correct local finding into a global change, twice — the scene shift and the
render tail. And a persistent bias toward *explaining* a symptom rather than
instrumenting it: the powerup bug survived four rounds of correct-but-invisible
fixes because each round produced a good story instead of a measurement.

The pattern is consistent enough to name. The failures are all cases where a
confident narrative was cheaper to produce than a measurement, and the narrative
was produced. The successful parts of the project are the ones where an
instrument was built first.

---

## What we would do differently next time

**Sweep for unreachable code from week one.** Ten lines of Python find exported
symbols and public methods that nothing calls. It would have found the name-entry
screen months earlier, and it costs nothing to run on every build.

**Sweep for indexed dispatches at the same time.** A scan for `move.b $0(aN,dM.w)`
preceded by a `lea` finds every table-driven call site in the program in one pass.
Two of this project's largest gaps — five sound effects and an entire sprite
class — were behind exactly that pattern.

**Diff the manifest, not just the code.** Both name-shadowing bugs would have been
caught instantly by comparing the generated manifest before and after a change to
the packer. The build already produces a machine-readable description of itself.

**Instrument the pipeline, not the state.** For anything that goes on screen,
check the pixels that survive to the end, not the variable that was set at the
beginning. `podcheck.mjs` counting pods and `contact_sheet.py` counting written
pixels each collapsed a multi-session bug into one run.

**Record what an instrument cannot do, next to what it can.** The emulator's
sprite-versus-bitplane limitation was discovered twice, because the first
discovery was not written down.

**Test the object graph the page actually owns.** An isolated state machine can
be flawless while production maintains a second, divergent copy of the same
state. Route tests should observe the instances imported and mutated by the
page, not merely instantiate the same classes beside it.

**Turn every diagnostic into a verdict.** Counts and status lines are useful
while investigating, but a test that only prints them passes when they are zero.
Once the expected invariant is known, encode it as an assertion and keep the
diagnostic output only as failure context.

**Keep the fitted and the measured visibly apart.** Not in prose — in the name.
A constant called `PF2_ORIGIN_X_FITTED` cannot be quoted as a measurement by
accident.

---

## Glossary

**Blitter** — the Amiga's block-copy and logic-operation engine; how sprites and
terrain are drawn into the bitplanes.

**BPLCON0/1/2** — bitplane control registers: plane count and modes (including
HAM and dual playfield), fine scroll per playfield, and playfield priority.

**CLXDAT** — the collision register. One read reports, and clears, which
combinations of sprites and playfields overlapped since the last read.

**Copper** — the display coprocessor. It runs a list of "wait for this beam
position, write this register" instructions once per frame, which is how the
screen changes mode partway down.

**DDFSTRT / DIWSTRT** — where bitplane data starts being *fetched* and where the
display window starts being *shown*. They are not the same place, and the
distance between them is a source of off-by-a-few errors.

**Dual playfield** — two independent scrolling layers from one set of bitplanes,
odd planes forming one and even planes the other.

**HAM6** — Hold And Modify: a six-plane mode where a pixel either picks a palette
entry or replaces one colour component of the pixel to its left, trading spatial
precision for a much larger colour range.

**Paula** — the audio chip. Four DMA channels, each with a sample pointer, length,
period and volume; channels 0 and 3 pan left, 1 and 2 right.

**Planar graphics** — an image stored as separate one-bit planes rather than as
bytes per pixel; a pixel's colour index is assembled from one bit in each plane.

**a5 / a6** — by convention in this binary, `a5` points at the globals block and
`a6` at the custom chip registers at `$dff000`. Almost every offset quoted in
this document is relative to one of those two.
