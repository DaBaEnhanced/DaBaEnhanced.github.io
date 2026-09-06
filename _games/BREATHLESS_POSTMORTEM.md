---
layout: page
title: "Rebuilding Breathless, and reading the engine that made it"
categories: jekyll update
---

## A technical postmortem of an Amiga-to-HTML/JavaScript/WebGPU port

This is the third project of its kind, after `SAINTDRAGON_POSTMORTEM.md` and
`MENACE_POSTMORTEM.md`. Those two describe recovering games from floppy images
and stripped executables — disk decoding, 68000 disassembly, guessing at
structures from byte patterns. This one is different in the way that matters
most: **the complete source code survives**. 25,058 lines of Devpac 68020
assembly across 22 files, with comments, in Italian.

That changes the method from archaeology to translation, and it changes what is
worth writing about. So the bulk of this document is not about how we recovered
Breathless. It is about what the source says, because Breathless is a 1996
texture-mapped first-person shooter on a machine that had no business running
one, and the engine is the interesting part.

Breathless was written by Fields of Vision and published by Power Computing in
1996 for the AGA Amiga — an A1200 with a 68020 at 14 MHz, or a 68030/68040 if
you had an accelerator. It shipped three years after Doom, on hardware five
years older than the PC Doom targeted.

---

## Executive summary

| Recovered component | Result |
|---|---:|
| Original source | 25,058 lines of 68020 assembly, 22 files |
| Port | 6,347 lines of JavaScript, 27 modules |
| Extraction and test tooling | 8,411 lines of Python and Node |
| Levels | 20 / 20, all playable, 100% of pixels written at 8 headings |
| Textures | 98, including 4 sky brushes and 6 animated |
| Optional HD art | 4x textures, 2x sprites, still palette-indexed |
| Objects | 43 (12 enemies, 11 projectile types, pickups, explosions) |
| Sounds | 47 (40 samples + 7 music modules) |
| Effect/trigger opcodes | 17 defined, 14 used, all implemented |
| Music format | P61A converted to Protracker, 7/7 structurally valid |
| Test harnesses | 31, all passing |
| Findings log | 3,954 lines across 52 rounds |
| Source files with no gameplay behaviour left unported | 22 / 22 |

Everything is now implemented. The only omissions are Amiga hardware 
concerns with no browser meaning: chunky-to-planar conversion, copper lists, 
interrupt setup, disk swap prompts, and the manual-lookup copy protection.

---

## What having the source changed

In the previous two projects the hard part was **discovering what the code
does**. Menace took nine phases to classify 195 routines and find that enemy
waves were a 16-opcode bytecode. Saint Dragon needed an emulator wired up as a
measuring instrument before anything could be checked.

Here the hard part moved somewhere else entirely. The behaviour is written down.
`CEDcolpito` is labelled "Status=5: colpito dal player" (Yeah, the Fields of Vision 
guys were italians judging by the comments). `movingdirtable` has a
comment on every row. Nothing had to be inferred from byte patterns.

What replaced it was **a much subtler failure mode: reading the source and
believing you have understood it.** Forty-two rounds of findings, and the great
majority of the bugs were not "we could not work out what this does". They were
"we read this, wrote something that looked equivalent, and it was not". A
representative sample:

- `MSctrlobjcoll` sums *two* object radii; we used one. It also has no vertical
  test, checks objects *before* floors, and only checks floors on a block
  change. Four separate misreadings of twenty lines of assembly.
- `obj_hheading` is a **slope** applied to distance travelled. We read it as a
  vertical velocity applied per tick, which made bullets climb between 1.6 and
  10 times too steeply depending on the weapon.
- `WALKANIM` is `(VBTimer & $1c) >> 2` — a global 0..7 counter. We wrote
  `(animCount + 1) % 16`, and since slots 8..15 of one particular facing hold
  the *death* animation, enemies flashed their own corpse frames while walking.
- Paula's sample rate is `PAL_CLOCK / period`. We wrote `PAL_CLOCK / (period*2)`
  and played every note an octave low for the entire project.

None of these were hard to find *in the source*. They were hard to notice in the
port, because in each case the code we wrote was plausible, self-consistent, and
passed the tests we had written for it.

---

# The engine

## What it is

Breathless is a **grid raycaster with per-column depth lists**. That is a
mouthful, so take it in pieces.

The world is a fixed `128 × 128` grid of cells, each 64 world units square
(`MAP_SIZE`, `BLOCK_SIZE` in `TMap.i`). The map is one word per cell: positive
means "open, this is block index N", negative means "solid wall, block index
-N", zero means void. Every cell points at a **block record** of 32 bytes:

```
bl_FloorHeight   W    the floor of this cell
bl_CeilHeight    W    the ceiling of this cell
bl_FloorTexture  W    what the floor is painted with
bl_CeilTexture   W    and the ceiling
bl_Illumination  W    light level, plus a fog bit
bl_Edge1..4      L    four pointers, one per side of the square
bl_Effect        B    an effect list to run when entered
bl_Trigger       B    which effect group this block belongs to
bl_Attributes    B    switch sides, sky flag, and so on
```

and each edge is:

```
ed_NormTexture   L    the wall
ed_UpTexture     L    the bit above a step down
ed_LowTexture    L    the bit below a step up
ed_Attribute     W    unpegging flags
```

If that layout looks familiar, it should. **A block is a Doom sector with
exactly four straight sides on a fixed lattice, and an edge is a linedef with
upper, middle and lower textures.** The data model is essentially Doom's,
constrained to a grid.

## The vtable: the idea that makes it work

A Wolfenstein 3D raycaster casts one ray per screen column, marches the grid,
stops at the first solid cell, and draws one textured strip. That gives you flat
floors, flat ceilings, uniform wall height, and nothing else.

Breathless casts one ray per screen column and stops at a solid cell like
anything else — but it **records every open cell it crossed on the way there**,
into a per-column array called the `vtable`:

```
vtdistance  L   how far away
vtblock     L   which block
vtbitmap    L   which texture column
vtedge      L   which edge was crossed
```

with room for `MAX_BLOCK_VIEW = 32` entries per column, for every column of the
widest supported window.

That is the whole trick. Those intermediate cells are not empty space — each has
its own floor and ceiling height. Once you hold an ordered list of *every
surface along this column* rather than just the nearest wall, you can draw:

- the near wall
- the floor beyond it, if the next block's floor is lower
- the step up to the next block, if it is higher (`ed_LowTexture`)
- the underside of the next block's ceiling, if it is lower (`ed_UpTexture`)
- and keep going until the column's visible window closes

That is how Breathless gets varying floor and ceiling heights, steps, pits,
raised walkways, doors that slide up, lifts that rise, and windows you can see
through — all of which a Wolf3D-style caster cannot do at all.

Two nice properties fall out of this design and are worth naming, because they
are not obvious:

**No perspective correction is ever needed.** Every wall is axis-aligned and
vertical, so a screen column always maps to a single texture column at constant
depth. Doom needs the same thing and gets it the same way — the whole reason
Doom draws walls as vertical strips is that a vertical strip has constant depth.
Breathless gets it for free from the grid.

**The map can be edited at runtime with no invalidation.** Doors and lifts are
just writes to `bl_FloorHeight` and `bl_CeilHeight`. There is no BSP to rebuild,
no visibility data to recompute. The effect VM (17 opcodes) edits block heights
directly and the renderer simply sees the new numbers next frame.

## Two passes, and a span table

`MakeFrame` in `DrawScreen.asm` is where the vtable becomes pixels, and its
structure is the second thing Breathless has in common with Doom.

Walls are drawn **column-major**: for each screen column, walk that column's
vtable entries and run `StretchNormalTexture`, `StretchUpperTexture` or
`StretchLowerTexture`. A vertical strip of a vertical wall is the cheapest
possible case — constant depth, so one fixed-point step per pixel down.

Floors and ceilings are the opposite. A horizontal plane has constant depth
along a *row*, not a column. So Breathless does not draw them during the column
pass at all. It **records spans into a per-scanline table** (`OTableList`,
initialised at the top of `MakeFrame`), and fills them afterwards with
`FillFloor` and `FillCeiling`, row by row.

This is exactly Doom's visplane split, arrived at independently or borrowed
knowingly — the source does not say. Either way the reasoning is forced: the
alternative is a divide per pixel.

## What it cannot do

The grid buys a great deal and costs specific things, all of them visible when
you play:

| | Breathless | Doom |
|---|---|---|
| Wall geometry | axis-aligned, on a 64-unit lattice | arbitrary 2D line segments |
| Diagonal walls | **impossible** | routine |
| Visibility | DDA march through a uniform grid | BSP tree traversal |
| Preprocessing | none | node builder, offline |
| Sector shape | always a 64×64 square | any closed polygon |
| Floor/ceiling per cell | exactly one of each | one per sector, same limit |
| Room over room | no | no |
| Sloped floors | no | no |
| Moving geometry | vertical only, edit a word | vertical only, no BSP rebuild |
| Lighting | 32 levels, LUT in index space | 32 levels, COLORMAP in index space |
| Wall drawing | column-major strips | column-major strips |
| Flat drawing | deferred per-scanline spans | visplanes, per-scanline spans |
| Sprites | 8 facings × 16 frames, clipped against the vtable | 8 facings, clipped against the same arrays |

The two engines are far closer than the three-year gap and the hardware gap
suggest. The **drawing** halves are near-identical in structure. The difference
is entirely in the **visibility** half: Doom pays for a node builder and gets
arbitrary polygonal rooms; Breathless pays nothing and gets a grid.

For a 68020, that is a defensible trade. A BSP traversal is pointer-chasing
through a tree that does not fit in the 68020's 256-byte instruction cache; a
grid DDA is an add and a compare in a tight loop. Breathless spends its cycles
on the thing the Amiga is worst at instead — which brings us to the real enemy.

---

# Fighting the Amiga

## The planar tax

This is the single largest structural difference between Breathless and any PC
shooter of the era, and it costs an entire extra pass over the framebuffer,
every frame, forever.

VGA mode 13h is **chunky**: one byte per pixel, 320×200, linear. Doom writes a
pixel by storing a byte. The Amiga is **planar**: 256 colours means 8 separate
bitplanes, and bit *n* of each pixel's index lives in plane *n*. Writing one
pixel means touching eight different addresses at eight different bit offsets.

No renderer can work that way, so Breathless does what every Amiga 3D game did:
it renders into a **fake chunky buffer** — one byte per pixel, exactly like the
PC — and then converts the whole thing to planar before display. That converter
is `c2p8.asm`: **981 lines of hand-tuned assembly** whose entire job is to
undo a hardware decision. On the PC that file does not exist.

The port inherits the good half of this and discards the bad half. `render.js`
draws into a `Uint8Array` of palette indices, because that is what the original
does; `gpu.js` uploads it as an `r8uint` texture with a 256×1 palette texture
and lets a fragment shader do the lookup. The c2p step simply evaporates.

## The quality dial

`ViewSizeTable` offers eight window sizes:

```
96×60   128×80   160×100   192×120   224×140   256×160   288×180   320×200
```

and `pixel_type` independently doubles pixels horizontally, vertically, or both.
Eight sizes times four pixel modes is **32 quality settings**, from 320×200
native down to 96×60 with doubled pixels — a 48×30 render, upscaled.

Doom had a screen-size slider too, but it only shrank the 3D viewport within a
fixed 320×200 and never scaled the pixels. Breathless's smallest setting renders
48×30 — **one forty-fourth** of the pixel count of its largest. That is not a
preference control; that is an engine admitting it cannot hit a playable frame
rate at full size on a stock A1200, and handing the player the dial.

The port keeps all 32, because `ComputeVars` derives `windowXratio` and
`windowYratio` from the pixel dimensions, which makes the projection genuinely
resolution-independent — a smaller window is the same view drawn smaller, not a
cropped one. `sizecheck` verifies this directly: the ray direction at a given
fraction across the window varies by under 0.001° across all eight sizes.

## Lighting without arithmetic

There is no per-pixel colour maths anywhere in Breathless, because a 68020
cannot afford any. Lighting is **32 precomputed remap tables** of 256 bytes:
palette index in, darker palette index out. `MakeFrame` computes a light level
per wall column (or per floor row) as `2 * T * windowYratio` plus the block's
own illumination, clamps it to 0..31, and then every pixel costs one indexed
byte read.

This is exactly Doom's `COLORMAP` — 34 tables of 256 bytes, the same idea for
the same reason on faster hardware. Both engines are doing lighting as a
*permutation of the palette*, not as a computation on colour.

Breathless adds a second bank of 32 tables for **fog**, ramping toward grey
instead of black, selected per block by a bit in `bl_Illumination`. And the
whole-screen fade at level start, teleport and level end (`TransEffect`) is the
same machinery again: run the finished frame through the lighting table at a
level that walks up and back down. Fog fade for teleports, black for levels.
One mechanism, four uses, zero arithmetic.

## Three channels for the music

The Amiga has four audio channels. Total. Doom on the PC had a sound card for
effects and a separate synth for music.

`InitAudio2` sets `P61_channels = 3-1`: the music gets **three** voices in game,
and the fourth is kept free so a sound effect always has somewhere to go.
`Presentation.asm` sets `4-1` for the title and ending screens, where nothing
else is making a noise. And `Audio.asm:110` drops the music to **two** voices
the moment an effect needs channel 2, restoring it at `:884` when that sound
stops.

So the music thins out while you are shooting. That is not a bug or a
compromise made in a hurry; it is a deliberate, dynamic allocation of a scarce
hardware resource, written into the mixer.

There is a lovely confirmation of it in the data. Limiting our mixer to three
voices changes MUS1, MUS4 and MUS5 not at all — **the in-game modules were
composed for three channels** — while MUST, the title music, measurably drops,
because it really does use the fourth. The composer knew.

## Everything is compressed

All assets ship inside `VDCO` containers holding an SLZ LZ77 stream, in two
variants (12-bit/4-bit and 11-bit/5-bit window/length encodings), grouped into
archive files by type: `TGLD` textures, `OGLD` objects, `SGLD` sounds, `GGLD`
palettes and lighting, `LGLD` levels, indexed by an `MGLD`. Music is P61A, a
format that exists specifically because Protracker modules were too big.

Twenty levels, 98 textures, 43 objects and 47 sounds had to fit on floppies and
into 2MB of RAM. The port decompresses all of it once, ahead of time, in
`tools/extract.py`, which is the whole benefit of having the source: the browser
fetches finished assets instead of reimplementing a decompressor.

---

# The coolest things in the source

### 1. `tx_AnimCount` means two different things

For a texture with `tx_Animation > 1`, `tx_AnimCount` is an animation counter.
For a texture with `tx_Animation <= 1` it is a **pointer to another texture** —
and `SwitchManagement` uses it to swap a wall's face when you press the switch
on it. `Swtc03_1` is 8232 bytes where every other 64×64 texture is 4116: it is
literally two texture records back to back, unpressed then pressed.

One field, two meanings, disambiguated by a different field. Very 1996.

### 2. Attribute bits name a *side*

A switch block's attribute bits 4–7 are 16, 32, 64 and 128, and each names one
of `bl_Edge1..4`. So a wall button only answers from the side it is painted on,
and `SwitchManagement` picks which bit to test from the player's heading. Of the
978 switch (block, side) pairs in the game, only 86 carry the actual button
graphic — the rest are doors and plain walls that also respond to the switch key.

### 3. The enemy aims by solving for a slope

`EnemiesFire` does not pick an angle. It computes the slope that puts the
projectile at the player's height *at the distance between them*:

```
    d0 = PlayerY - obj_y(enemy) - PLAYER_EYES_HEIGHT
    d0 * 32768 / distance
```

and since the projectile's height is `y0 + hheading * travelled / 32768`, at
`travelled == distance` the arithmetic cancels exactly. Aiming is one divide.

### 4. Passwords are the entire save state

`LevelCodeOut` packs health, shields, energy, credits, score, weapons, the
active weapon and the level number into a checksummed value, XORs it with
`$65A4B52D` and base-32 encodes it. There is no save file. The 16-character code
*is* the save file, and typing one restores your exact loadout.

### 5. The walk cycle is one global counter

`WALKANIM` is `(VBTimer & $1c) >> 2`. Every walking enemy in the level is on the
same frame at the same time, driven by the vertical blank counter, because
storing a per-object animation counter costs memory and a per-object increment
costs cycles. It also means enemies visibly march in step, which nobody notices.

### 6. Diagonal movement is a rotation, not a vector sum

`movingdirtable` maps a direction bitmask to a heading offset and a sign. Moving
forward-and-right is `heading + 256` (45°) at the *same* scalar speed, not the
normalised sum of two vectors. One multiply instead of two plus a square root.
`updspeedtable` then says whether a direction change should zero the speed,
negate it, or keep it — which is what lets a straight run become a diagonal
without losing momentum.

---

# Making it HD

The port renders at whatever resolution you ask for -- the original's own
`ComputeVars` derives `windowXratio`/`windowYratio` from the pixel dimensions,
so resolution independence was already in the 1996 code, put there to let the
player shrink the window for speed. Running it the other way gives 1280x800 for
free.

What you get at 1280x800 is a very sharp view of 64x64 textures. Each texel
covers about sixteen screen pixels. The geometry is crisp and the art is
Minecraft.

So: can the art be upscaled? The obvious answer is no, and the reason is the
best thing about the engine.

## The palette is the whole problem

Breathless renders in **index space**. A wall texel is a byte; `MakeFrame` turns
it into a lit byte through a 256-entry table; colour appears only in the final
present pass. Lighting is that lookup. Fog is a second bank of the same tables.
The fades at level start, teleport and level end are the same tables again.

An upscaler returns RGB, and RGB has nowhere to go in this renderer. Feed it
true colour and you do not get a prettier game, you get a game with no lighting,
no fog and no fades -- because all three are permutations of a palette the
upscaled art is no longer drawn from.

The way through is to upscale in RGB and then **quantise back to palette
indices**, so the HD art is still bytes and every table downstream still works.
That sounds like it should destroy the image, and the interesting result is that
it does not -- for a reason that belongs to the original artists rather than to
anything we did.

The game has one palette (plus a red damage-flash variant over the *same*
indices), every texture draws from it, and a single 64x64 texture uses only
about **54 of the 256 entries**. The palette is far richer than any one texture
needs. So an upscaled texel that lands between two of its own colours usually
finds a near-exact match somewhere else in the palette -- in a ramp belonging to
some other wall. Measured: snapping a 4x upscale back costs a mean RGB distance
of **3.2**, against roughly 8 for a just-noticeable difference.

The AGA palette limit, which is the constraint the whole engine is built around,
turns out to be what makes HD art possible thirty years later.

## One field, four sample sites

The runtime change is smaller than the tooling. HD art is not a second code
path; it is the same path with a different number in it.

Every `Stretch` macro maps one world unit to one texture row. A 4x texture needs
four texels per world unit, so each texture and sprite record carries a `scale`,
read at the three sample sites in `render.js` (wall, sky, flat) and the one in
`sprites.js`:

```js
const ts = tex.scale ?? 1;
let u = Math.floor(uWorld * ts) % tw;
const vStep = worldH * ts / span;
```

Sprites divide their frame *size* by `scale` while leaving `xoff`/`yoff` alone,
because the anchor is measured against the 1x sprite. That asymmetry is the one
place the change is not mechanical.

Everything else -- lighting, fog, `TransEffect`, the automap, collision, the
effect VM -- is untouched, because it all still operates on indices. Switching
art sets mid-level rebuilds one table and nothing else.

The HD set is **fetched on demand**, not at startup: 10.8 MB gzipped against
1.1 MB for the original art. Textures are 4x (9.5 MB) and sprites 2x (46 MB);
4x sprites would be 184 MB, because a sprite texel is two bytes -- index plus
matte -- across 1,638 distinct frames. The matte is resampled nearest-neighbour
and never filtered: a 1-bit matte that gets interpolated rings, and a GAN
invents edge pixels that fringe against the wall behind.

## Choosing an upscaler, and measuring the wrong thing twice

The first attempt was Lanczos. It passed every correctness check and made the
frame **less** detailed, which is not a bug: Lanczos interpolates, quantisation
bands the interpolation, and the result is a softer texture than the source.

Worse, the metric agreed with it for the wrong reason. Counting colour changes
across a row of the frame *rewards blockiness* -- nearest-neighbour
magnification puts a hard step at every texel boundary, so the measure ranks the
thing being replaced above every possible replacement.

The measure that asks the real question is **sub-texel variation**: inside one
original texel the source is flat by construction, so anything there is
information it could not hold. Paired with **fidelity** -- does the HD block
average back to the colour it replaced? -- it separates detail from invention.

Across seven ESRGAN-family models plus a Lanczos baseline:

| model | subtexel | fidelity | |
|---|---:|---:|---|
| nearest (what 4x rendered before) | 0.00 | -- | the problem |
| lanczos | 3.60 | 2.47 | adds nothing |
| 4x-NXbrz | 2.60 | 3.91 | *below* a blur |
| 4x-Fatality-MK2 | 6.77 | 5.31 | adds too much |
| **4x-UltraSharpV2** | **4.37** | **2.86** | adds what is there |

Two results worth keeping. The pixel-art scalers (NXbrz, Sphax, PixelPerfect)
score at or below Lanczos: they posterise into flat regions, which is exactly
what they are for and the opposite of what photo-sourced Amiga textures want.

And ranking on `subtexel` alone picks Fatality-MK2 -- which I did, and shipped.
Looking at a crop beside the numbers shows what its 6.77 was counting: invented
vertical brushed-metal grain laid over the whole wall, nowhere in the source
art. The `fidelity` column had been saying so the entire time at 5.31, against
2.47 for a filter that adds nothing at all. I had built a two-sided measure and
then read one side of it.

UltraSharpV2 adds clearly more than a filter (4.37 against 3.60) while drifting
barely more than one (2.86 against 2.47), and it is what ships. The pipeline
takes `.pth` through spandrel and `.onnx` through onnxruntime; the scale is
measured by running a 16x16 probe rather than read from the model, because
these files routinely declare their output shape using the input's own symbolic
dimension names.

---

# Retrospective

## What went well

**The renderer was right early and stayed right.** `coverage.mjs` renders every
level at eight headings and counts pixels never written; it has read 100.00% on
all 20 levels since round 12. The one hard bug in the geometry — a
`ceil`/`floor` mismatch that dropped one row per seam and produced the "polygons
cut by the thing behind" the user reported — was found and fixed in a single
round because the instrument already existed.

**Asserting exact byte consumption caught format errors immediately.** The level
parser asserts that it consumes precisely the bytes the file contains. 20/20
exact, and any misunderstanding of the format failed loudly at extraction time
rather than quietly at render time.

**The effect VM.** 17 opcodes, 14 used, all implemented and covered. Doors,
lifts, lights, teleports, terminals, level exits and enemy activation are all
one mechanism, and `reachprobe` walks every level by firing every reachable
trigger to confirm the level opens up.

## What was hard

**Fractional ticks against integer arrays.** The original runs at 50 Hz and uses
"ticks elapsed" directly as a pixel count. At 60 fps a tick is 0.83, and
`Int16Array[b] += 0.83` stores **zero**. Doors played their opening sound, ran
their full cycle, and never moved. This class of bug — correct logic, wrong
numeric domain — bit three times before we started accumulating whole ticks
everywhere.

**Knowing when *not* to transcribe.** `Atxmu`/`Atxcd` in the texture animator
forbid two consecutive zero-advance passes, to smooth a coarse frame counter
where a frame was 2–5 ticks. At 60 fps a pass is 0.83 ticks, the quotient is
zero nine frames in ten, and transcribing the rule faithfully forces an advance
every other frame — 30 a second against an intended 6.25. Faithfulness to the
letter produced behaviour the original never had. That is a judgement call, and
it is documented in the code as one.

**Fitted versus measured.** Kept visibly apart throughout, as in the previous
two projects. The LED filter's 3275 Hz corner is fitted — nothing in the source
names it, because it is a property of the hardware — and says so in a comment.
The 32 lighting levels, the 64-unit block, the `heading/2` sky pan and Paula's
`PAL_CLOCK / period` are all measured, from the source, and cite it.

---

## What went badly, and why

This is the part worth reading, because the failures were all one failure.

### 1. Every harness agreed with the engine, and the engine was wrong

The recurring shape, stated as plainly as it can be: **a test that drives the
engine on its own terms will agree with the engine.** Only a test that drives it
the way the real environment does can disagree.

- `gunprobe` fired down a clear corridor at a target dead ahead. Every version
  of the hit test passed it, including the one with four separate errors.
- Every effect harness called `fx.update(1, ...)`. Whole ticks. The door bug
  lived entirely at fractional ticks and was invisible to all of them.
- `browserprobe` *tapped* Escape — keydown and keyup in one script step — so the
  key was never held when a frame ran, and a menu that closed itself on the
  next frame passed.

The fix each time was to make the harness drive the input with its **real
duration** and read back what the engine **actually did**, rather than inferring
it from a model of what it should have done. `moveShots` now records why each
projectile stopped, purely so a harness can tell a bullet that correctly struck
a wall from one that flew through a target.

### 2. A stub that provides more than reality manufactures passes

This one was expensive and the lesson is sharper than the others.

Music was silent in the browser for four rounds. Every harness passed. The Node
tests rendered audio correctly. The cause was `TextDecoder`, used in `parseMod`
for the module title — and **`AudioWorkletGlobalScope` does not have
`TextDecoder`**. It is a deliberately tiny realm: no fetch, no timers, no
document, no TextDecoder.

Node has it. And so did the scope our stub evaluated the worklet source in,
because it was built with `new Function(...)` and called from the ordinary
module realm. The stub was not emulating AudioWorkletGlobalScope; it was
emulating "some JavaScript runs somewhere".

> It is not enough to run the real code through the real path. The code must run
> in a realm with the **same things missing**. A stub that is strictly more
> capable than the real environment does not merely fail to catch bugs — it
> actively manufactures passes.

`addModule` now shadows every name the real scope lacks. And the worklet's
`onmessage` is wrapped in try/catch that posts the error back, because an
exception in there unwinds into the audio thread where nothing is listening.

### 3. A warning printed on every run is not a warning

`music worklet unavailable: ReferenceError: AudioWorkletNode is not defined` had
been printing on every single harness run since the day `browserprobe` was
written. It was read as "the stub does not do audio" rather than "the entire
music path is untested". It was the second one.

### 4. Two implementations of one constant, and nothing compared them

`audio.js` computes sound-effect pitch as `PAL_CLOCK / s.period` — correct.
`protracker.js` computed note pitch as `PAL_CLOCK / (period * 2)` — an octave
low. The two halves of the port disagreed about a physical constant for the
whole project, sound effects were right, music was wrong, and no test compared
them. The bug was not in either piece of code. It was in the gap.

`sndprobe` now asserts the two agree, which is the cheapest test that could
possibly have caught it.

### 5. A summary statistic answering a question nobody asked

`reachprobe` reported levels 0009, 0013 and 0015 at 0%, 3% and 4% connectivity
for three rounds, flagged each time as "possible content bug, uninvestigated".

It was the probe. It flooded the map **after** running the effects to
completion — by which time every door had opened, waited, and shut again. It was
measuring the level with all its doors closed, which is not the level anybody
walks through. It also never followed a teleport, and 0023 is built around four.

Fixed, every level reads 86–100%. The same shape appeared again in audio: a
regression check averaged over eight seconds and passed with a bug that silenced
the first four. **An average over the wrong window hides a total failure.** A
probe that measures a time-varying system has to say *when* it is measuring.

### 6. Believing the harness over the person

Rounds 37 and 38 each found and fixed a genuine bug — two silent modules; no
`resume()` call, a fatal preload, dead settings — and neither was the reported
one. The emulation said PASS; the user said silence. It took until round 39 to
move the measurement out of our emulation and into a browser, which is where the
difference lived.

> When a harness and a person disagree about whether something works, the
> harness is the thing to doubt.

### 7. An isolation that was never un-isolated

The HD renderer probe ran with `drawObjects = false`. I turned objects off to
isolate wall texturing, then never turned them back on -- so the entire sprite
path went untested, and a sprite bug was living in it.

The HD build wrote its manifest records by *listing* the fields it knew about
instead of copying the record it started from. It dropped `link` -- the switch's
pressed face, the exact field round 44 went digging for -- so wall buttons
stopped changing colour. In the sprite half it dropped `src`, which `enemies.js`
compares between adjacent frames to find where an animation ends. Two missing
values compare **equal**, so every animation ended on its first frame: 403 of
1,595 frame pairs affected.

Neither is visible in a render comparison. I had measured 98.8% pixel agreement
between the two art sets and called the swap verified. What I had verified was
that the *pixels* were right.

> An isolation that is never un-isolated is a hole shaped exactly like the
> thing it excluded.

The fix in the test was to stop asserting appearance and start asserting
preservation: diff the key sets of the two manifests, and compare `src` identity
as a *relationship between frames* -- frames that shared source art must still
share it, frames that did not must still not. A relationship survives a change
of representation; a value does not. The fix in the tool was one line: copy the
source record and override only the three things the upscale actually changes.

It took the user asking "well button don't change color anymore?" to find it.
That is twice now -- see 6.

### 8. A metric that can be gamed needs its counter-metric read beside it

Covered in *Making it HD*: `subtexel` rewards a model for adding *anything*,
including things that were never there. `fidelity` is the column that catches
invention, and I built both and then ranked on one. The user's own choice of
model beat mine, and my own second column said so.

> A number that can be gamed by invention measures activity, not quality, until
> you read it next to the number that catches invention.

---

## The final architecture

```
tools/extract.py          SLZ/VDCO decompression, all six archive formats,
                          P61A -> Protracker, fonts, panel, level parsing
                          -> web/assets/  (binaries + JSON manifest)

web/src/
  render.js               MakeFrame: DDA raycast, per-column vtable, wall
                          strips, deferred flat spans, lighting LUTs, sky
  sprites.js              DrawObjects: projection, depth sort, vtable clipping
  automap.js              AutoMapping + MapMode
  fade.js                 TransEffect, through the lighting tables
  enemies.js              the object world: AI states, projectiles, collision
  weapons.js              the six guns, from the SHOT object params
  effects.js              Animations: texture animation + the 17-opcode VM
  movement.js input.js    DoMovement, the three key tables, mouse look
  audio.js protracker.js  Paula channel allocation, LED filter, MOD playback
  panel.js terminal.js    the status panel and both terminal modes
  levelcode.js            the password codec
  gpu.js                  r8uint index texture + 256x1 palette, integer scaling
  shell.js touch.js       top bar, fullscreen, two-thumbstick phone controls

tools/hd/upscale.py       4x textures / 2x sprites through an ESRGAN model,
                          quantised back to palette indices
tools/hd/bakeoff.py       subtexel vs fidelity across upscaler models
                          -> web/assets/hd/  (optional, fetched on demand)
```

31 harnesses, 3,954 lines of findings, and a document —`AUDIT.md` — that walks
every one of the 22 source files and states what was ported, what was not, and
why.

---

## Closing

Breathless is a better engine than its reputation. It was reviewed at the time
as a Doom clone that ran too slowly, and it is neither of those things exactly:
it is a grid raycaster with an explicit per-column visibility list, which is a
genuinely different and rather elegant answer to the same question Doom asked,
and it runs slowly because it is doing chunky-to-planar conversion on a 14 MHz
68020 with no help from any of the Amiga's custom chips.

What the source shows is a team that understood their machine precisely. The
32-step quality dial, the three-voice music that yields a channel to gunfire,
the lighting done as a palette permutation, the aiming solved with one divide,
the switch texture hidden in an animation field — none of that is naive. It is a
game built by people counting cycles and bytes, and the constraints are visible
in every design decision.

The port is 6,347 lines of JavaScript for 25,058 lines of assembly, and roughly
half of that ratio is the c2p converter, the copper lists, the disk handling and
the interrupt plumbing simply not existing any more. The other half is that a
`for` loop over a `Uint8Array` says in one line what a 68020 says in twelve.

The engine itself translated almost directly. It was never the engine that was
hard.
