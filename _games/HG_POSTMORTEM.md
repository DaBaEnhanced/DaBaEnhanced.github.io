---
layout: page
title: "Hired Guns Web Port — Post-Mortem"
categories: jekyll update
---

# Hired Guns Web Port — Post-Mortem

## Executive summary

We ported the Amiga CD32 version of *Hired Guns* to a browser-based runtime built with HTML, JavaScript, and WebGPU, with a Canvas 2D fallback. The objective was not simply to make a game that looked similar: it was to reproduce the original four-player, split-screen game at its native 320×212 resolution by treating the original assembly and assets as the specification.

The port is now functionally complete. It includes the campaign shell, character selection, maps, four simultaneous views, game logic, inventory, monsters, team movement, audio, and generated versions of the original data and graphics. The work succeeded because we repeatedly moved from visual guesswork to source-led reconstruction, then backed that reconstruction with whole-corpus regression checks.

The central lesson is straightforward: this was less a conventional rewrite than an archaeology project. The hard work was discovering the rules hidden in data layouts, blitter operations, Copper-list palette changes, and timing assumptions—not writing JavaScript itself.

## Technical primer: what the original machine was

### Amiga and CD32 in one page

*Hired Guns* was originally made for the Commodore Amiga family. The CD32 was a 1993 console built around the Amiga's AGA chipset. Its main CPU was a Motorola 68EC020, a 32-bit processor from the same family used in workstations and early embedded systems. The original game is largely 68000-family assembly language, with data declared alongside code using directives such as `dc.b` (define bytes), `dc.w` (define 16-bit words), and `dc.l` (define 32-bit longwords).

It is useful to think of this machine as having a CPU plus specialised display coprocessors. A modern game usually produces RGBA pixels in a framebuffer and lets a GPU render them. The Amiga instead represented an image as several one-bit image planes, then combined them into a palette index at display time. Dedicated hardware could copy and combine rectangular bitplane regions while the display hardware changed palette entries during a frame.

The port does **not** emulate an Amiga or execute the original assembly in the browser. It reimplements the observable game rules and display operations in JavaScript, using the original source and data as the behavioral specification. That distinction was important: full machine emulation would have been a different project with different performance, integration, debugging, and preservation tradeoffs.

### The rendering vocabulary

| Original term | Meaning on the Amiga | Rough modern analogue |
| --- | --- | --- |
| Bitplane | A 1-bit image layer. Six planes give a 6-bit palette index (0–63). | A single channel/bit of an indexed render target. |
| Palette / colour register | A small table mapping index values to RGB colours. | A palette lookup texture or colour LUT. |
| Blitter | A hardware unit for copying rectangles and applying Boolean operations to bitplanes. | A small fixed-function 2D compute/blit pass. |
| BOB | “Blitter Object”: an image plus metadata telling the blitter how to draw it. | Sprite/texture region plus render state. |
| Copper | A display coprocessor that executes simple instructions in sync with raster position. | A scanline-timed display program; closest in spirit to a tiny raster shader with side effects. |
| Raster line | One horizontal line being drawn to the display. | A scanline in a display pipeline. |
| Vblank | The period between frames, used for stable game updates. | A fixed simulation tick, here 50 Hz. |

### Why indexed colour was not a cosmetic limitation

The game uses six bitplanes. At each pixel, their bits form a number from 0 to 63, which indexes a colour register. Two of those bits have semantic roles:

- plane 4 adds 16, selecting the water-tinted palette bank;
- plane 5 adds 32, selecting the lit palette bank.

For example, base colour 6 may appear as 6, 22, 38, or 54 depending on whether the pixel is underwater-tinted, lit, or both. Light and water therefore are not translucent overlays in the modern RGBA sense; they are modifications to the palette index itself. That is why the port keeps an indexed composition buffer until the final presentation step.

### What the Copper adds

The Copper can wait for a chosen raster line and then write a colour register. This lets the game vary colours as the beam moves down the screen: sky gradients, horizon haze, planet washes, and animated energy fields all use this technique. It also means there is no single immutable palette for a frame.

In the web port, the palette builder replays the relevant Copper-list instructions up to the game's view area, then records raster-dependent colours as synthetic palette indices. The runtime can thus preserve the source's scanline effects even though WebGPU and Canvas 2D do not expose an Amiga-style Copper.

### What the blitter adds

The blitter combines source and destination bitplanes using simple operations. In this game, an object can copy its colour bits, clear a plane, set a plane, or leave it untouched. Some “objects” therefore contain no conventional image pixels at all: they just change plane bits underneath their mask.

That explains several visual effects:

- a light BOB sets plane 5, moving existing pixels into the lit palette bank;
- water sets plane 4, retaining the floor's underlying colour but tinting it;
- puddles copy only the water bit, so they remain see-through;
- fields and some effects are palette/plane arithmetic rather than painted sprites.

For a machine-learning or computer-vision analogy, the final frame is closer to a composition of binary masks and discrete label transforms than alpha blending of RGB images. We needed to preserve the labels and their operations, then colourise only at the end.

<img src="{{ site.cdn_url }}/images/hgblittercopper.jpg" alt="Hired Guns 2.5d engine" style="object-position: center;" />


## What we set out to do

- Target the CD32 build as the authoritative version, rather than the base Amiga build.
- Preserve native-resolution, four-way split-screen rendering and integer upscaling.
- Build a WebGPU renderer with Canvas 2D as a fallback and correctness oracle.
- Recreate behavior from the original source and assets, rather than approximating it from screenshots.
- Keep deliberate product changes clearly separated from source-faithful behavior.

## What we delivered

- A dependency-free browser runtime using ES modules.
- WebGPU and Canvas 2D presentations of the same palette-index compositor.
- All 47 maps converted from original map data into web-ready assets.
- Faithful world systems: movement, stairs, falling, water, lifts, doors, buttons, pushables, teleports, boosts, and lighting.
- Inventory, Store/Info/Stats panes, item icons, characters, monsters, skeletons, team following, combat effects, and UI gadgets.
- Original-style front end, character select, world map, location flow, results screens, SFX, music, and atmospheric audio.
- Asset pipelines for graphics, maps, palettes, fonts, portraits, monsters, items, UI, sound, and music.
- A pixel-comparison harness covering 752 views across every map and player-facing combination.

## How the port was made

### 1. Treat the original code as the specification

The original assembly was the primary source of truth. Rendered output was useful for validation, but it was not enough to infer behavior safely. Whenever we guessed from appearance instead of reading the source, we eventually paid for it in rework.

This mattered especially for:

- data structures and bit fields in maps;
- blitter BOB controls and per-plane operations;
- Copper-list palette programming;
- rendering order and occlusion;
- 50 Hz timing and counter behavior;
- edge cases in movement, falling, doors, lifts, and pushables.

### 2. Build extraction and conversion tooling first

Rather than hand-convert game content, Node-based tools decode the original formats and generate runtime assets. This established a repeatable bridge between the original source tree and the browser game.

The pipeline decodes IFF/ILBM art, BOB graphics, RNC-compressed data, map files, palettes, fonts, audio, music, and gameplay tables. Generated assets are not maintained manually: when a decoder improves, the data can be rebuilt consistently.

### 2.1 The original file formats, in practical terms

The source tree contains both human-readable assembly and many compact binary assets. These assets were designed for fast loading and efficient use of limited RAM, not for future interoperability. The web tooling turns them into JSON metadata, indexed atlases, binary cell layers, WAV files, and OGG files.

| Format / source | What it contains | Porting challenge |
| --- | --- | --- |
| IFF / ILBM | Standard Amiga image containers, often bitplane encoded. | Image rows and planes need decoding before they become modern image data. |
| BOB `.bin` / compiled graphics | Object slots, masks, plane operations, placement data, and bitplane image data. | It is not just an image format; metadata changes how every slot is rendered. |
| `.map` files | Three packed 23×23×20 world layers plus headers and action tables. | Gameplay state is densely bit-packed and table offsets are relative to the map base. |
| RNC ProPack | Compressed maps/graphics. | The decompressor required a faithful port of the original bitstream logic. |
| MED modules | Tracker music: patterns, samples, timing, and effects rather than a rendered waveform. | Browser playback uses pre-rendered OGG music for robustness. |
| SVX / raw samples | Amiga-era audio sample data. | Converted into browser-playable WAV effects while retaining source pitch behavior. |
| Assembly data tables | Items, characters, messages, palettes, and behavior constants. | Data may use custom text encodings, macros, offsets, and language banks. |

#### BOB graphics: image plus a tiny render program

The most important format was the BOB. A BOB file starts with a short header, then a table of draw slots, then bitplane data. A slot contains width, height, signed X/Y offset, control value, and an offset into image data. Most BOBs have 67 slots because the original renderer draws fixed positions across five depth rows and three vertical levels.

The crucial discovery was that the bitplanes are stored contiguously by plane: all rows for plane 0, then all rows for plane 1, and so on. This differs from the row-interleaved layout many developers expect from ILBM, and the wrong assumption produces recognisable but corrupted noise.

Each BOB also carries per-plane operations. In pseudocode, a covered pixel behaves like:

```text
for plane in 0..5:
    resultBit[plane] = operation[plane](destinationBit[plane], sourceBit[plane])
```

Those operations make a BOB partly image data and partly a tiny compositing program. The web asset builders preserve both its coverage mask and its plane-operation metadata.

#### Maps: a compact 3D database

Each map is a fixed 23 × 23 × 20 cell volume. It has three packed 32-bit layers per cell:

- the main cell layer describes floor/block/water/panel/AUX presence, types, variants, opacity, invisibility, and pushability;
- the seen layer records exploration state and flowing-water flags;
- the items layer carries loose-item data, lighting, sky settings, and teleport/boost payloads.

The map header additionally holds tables for buttons, lifts, doors, pushables, and text panels. Some values that look like indices are actually byte offsets from the start of the map, and the action type determines which table the offset addresses. This is a common pattern in older binary formats: compact and fast, but unsafe to infer from nearby data.

#### Text and localization: bytes do not equal ASCII

Strings use a game font encoding. Space is byte 127 rather than ASCII 32, byte values below 32 are colour-control codes, and messages are stored in banks containing offset tables and per-record scratch fields. Character data also initially appeared to describe 60 people, but actually encodes 12 characters in five languages. The parser had to understand these layouts before text could be rendered correctly.

### 3. Recreate the renderer as palette and plane operations

The Amiga version is not a simple sprite renderer. It composes six bitplanes with blitter operations, then lets the Copper alter colour registers as the raster moves down the display. We implemented a shared 320×212 palette-index compositor and presented it through both WebGPU and Canvas 2D.

The rendering implementation therefore models the original ideas directly:

- art coverage and masks;
- copy, clear, set, and no-draw plane operations;
- lighting and water as palette-bank bits rather than separate textures;
- fixed view slots, depth ordering, and source draw order;
- synthetic palette indices for raster-driven sky, horizon, planet, and force-field gradients.

#### The BOB renderer: a 3D world without a 3D renderer

The original game does not rasterise polygons, cast rays, or project arbitrary 3D geometry. Its first-person view is built from pre-drawn BOBs at a fixed set of perspective positions. Each player can see a small, grid-aligned part of the 23×23×20 map; the renderer samples that grid into **67 fixed draw slots**: five depth rows, several horizontal offsets, and three vertical levels (above, current, and below the player).

For each visible cell, the game chooses the appropriate pre-authored BOB slot for its depth and lateral position. A wall that is one cell away is therefore a different piece of 2D art from the same wall three cells away; floors, doors, stairs, water, trees, panels, and objects all have their perspective and placement baked into the slot data. Turning the player does not rotate a camera through geometry. It rotates the grid coordinates and remaps directional block types before selecting these prepared images.

The final illusion comes from painter's ordering. Far cells are drawn before near cells, and each cell has a source-specific sequence—rear light, auxiliary object, block, panel, water, explosion, side light, and floor, with different order above and below the player. Because many BOBs modify existing plane bits rather than simply paint opaque RGB pixels, this ordering determines lighting, tint, occlusion, and whether decals appear to sit on the correct surface.

In modern terms, it resembles a highly constrained neural-rendering or sprite-based view synthesis pipeline: discrete scene labels are sampled from a voxel grid, mapped to view-conditioned image patches, then composited in a predetermined depth order. The constraint is also the advantage: almost all perspective work was authored once in the original assets, allowing an Amiga to produce four simultaneous first-person views with no general-purpose 3D engine.

<img src="{{ site.cdn_url }}/images/hg_3d.jpg" alt="Hired Guns 2.5d engine" style="object-position: center;" />

#### Modern pipeline mapping

```text
Original source/assets
  → decoders and asset builders
  → indexed atlases + draw-slot metadata + JSON game data
  → JavaScript view construction (what is visible, in what order)
  → 320×212 palette-index compositor (what each pixel label becomes)
  → WebGPU or Canvas 2D palette presentation
  → browser display
```

The separation between “construct an indexed frame” and “present it as RGB” was intentional. It mirrors the original hardware model and means the WebGPU and Canvas paths can share the behaviorally important part of the renderer.

### 4. Port systems in source-sized pieces

Gameplay was broken into focused modules such as movement, falling, doors, lifts, buttons, pushables, world effects, gadgets, and team movement. That made it possible to connect each implementation to a corresponding source routine and test individual systems without destabilising the rest of the game.

The approach is comparable to translating a legacy numerical pipeline: first identify the state representation and update order, then reproduce each transformation with explicit tests. We did not try to translate assembly instructions mechanically. Instead, we ported the intent of routines into readable JavaScript while retaining source-defined state transitions, bit fields, thresholds, and ordering.

### 5. Validate continuously across the full game corpus

The core renderer check compares an independent software view renderer with the production runtime compositor for every start position and facing in all 47 maps: 752 comparisons in total. The expected result is zero mismatches.

Dedicated smoke tests cover combat, HUD icons, inventory, monsters, water, completion, characters, skeletons, team movement, stats, solid player effects, audio, and the campaign shell. Visual checks against original CD32 footage remain necessary, because two web implementations can agree while both differ from the original.

## What we discovered

### The data was much less conventional than it first appeared

- BOB planes are stored plane-contiguously, not row-interleaved like ILBM images.
- BOB slot coordinates are signed; treating them as unsigned caused close-range tree art to disappear.
- Palette index zero is a real art colour, not transparency. The atlas format needed to store each palette index as `index + 1` to preserve it.
- Compiled CD32 item BOBs—not the seemingly obvious source ILBM—are the correct inventory-icon source.
- The map is three packed layers with behavior spread across flags, type fields, variants, and table-relative offsets.
- Text and messages use game-specific encodings and banked structures, not ordinary ASCII strings.
- RNC decompression required a close port of the original routine; reconstructing it from memory was unreliable.

### Lighting and water are data-model problems, not visual effects

The game has four palette banks. Plane 4 adds the water bank and plane 5 adds the lit bank. A single art colour may therefore resolve to one of four palette entries depending on its local plane state.

This led to an important design choice: preserve indexed pixels and plane arithmetic throughout composition. Treating lighting as an after-the-fact darkening filter would have lost the original hue, haze, water tint, and decal behavior.

### The Copper list is executable display logic

The palette is not a static table. The Copper modifies registers at specific raster lines, including changes inside the 3D view. To reproduce the display, we replayed the relevant part of the list rather than sampling a single palette declaration. This also required handling AGA low-colour-table semantics correctly.

### Draw order is gameplay-visible

The order in which a cell's floor, walls, decals, water, panels, lights, auxiliary objects, and explosions are emitted determines whether surfaces occlude one another correctly. Several effects are plane operations applied to pixels already in the buffer, so a “visually reasonable” ordering can cause artifacts such as decals bleeding through walls.

### Original timing is tied to PAL vblank—and sometimes to render speed

Most world counters advance at 50 Hz. Driving them from `requestAnimationFrame` made the game speed depend on monitor refresh rate. Falling exposed a subtler issue: the original's falling progression was constrained by the old render loop, not only by its counter. The port isolates this one compensating constant so it can be tuned against footage without obscuring the source behavior elsewhere.

## What went well

### Source-led development became a force multiplier

Reading the actual routines often looked slower than inferring behavior from output, but it consistently shortened the total path to a correct solution. It made unusual choices—such as doors built from mirrored split BOBs and water represented as a palette-bank operation—understandable and reproducible.

### A shared compositor kept the two renderers aligned

WebGPU and Canvas 2D share the same indexed composition path. The Canvas implementation is therefore not merely a fallback; it is a practical diagnostic reference that helped find presentation-specific issues.

### Full-corpus tests revealed real edge cases

Testing all maps caught failures that single-scene tests would have missed: uncommon graphics slots, moving water startup, pushable behavior, special map tables, and edge-case data. The scope of the corpus turned vague visual suspicion into measurable evidence.

### The tooling made reverse engineering durable

Format knowledge now lives in decoders, builders, generated metadata, and tests—not only in developer memory. That is a major long-term gain for maintenance, visual improvements, and future editor work.

### We preserved fidelity while allowing explicit deviations

Product choices were documented rather than silently folded into the emulation. Examples include deferred button actions, floor-item preview in inventory, pre-rendered browser music, and the planned opt-in treatment for tall objects. This keeps the faithful path auditable.

## What was hard—and why

### Ambiguous-looking assets hid important distinctions

The BOB format has two different control fields with different meanings. Confusing them caused placeholder geometry to be drawn as art. Likewise, “no pixel” and palette colour zero initially looked identical in a naïve atlas representation but were not the same thing in the game.

### Hardware behavior had to be reconstructed, not emulated wholesale

The port had to replicate the effects of bitplanes, blitter operations, Copper timing, palette banking, and fixed view slots without running Amiga hardware. The challenge was choosing the smallest browser representation that retained the semantics that mattered.

### Faithful behavior sometimes includes original quirks

The source includes unused systems, dead data paths, odd table behavior, and bugs: a monster whose direction is randomised but never stored, a zero-speed squirrel, dead corpses not always stamped, and specific fall-through behavior. Deciding whether to preserve or fix these requires an explicit product policy; silently “improving” them would make the result less faithful.

### Tests can be wrong too

Some apparent failures were test setup errors: a fall described as dry actually ended in water, and push tests placed the pusher inside a wall. The lesson was to validate test preconditions before changing production logic.

### Browser constraints differ from the original machine

Browser animation callbacks pause in hidden tabs, refresh rates vary, Web Audio needs user interaction, and browser music playback does not naturally use MED modules. These required deliberate runtime choices rather than a line-by-line transplant.

## Mistakes we made, and the corrective lessons

| Mistake | Impact | Lesson |
| --- | --- | --- |
| Assumed ILBM-style row-interleaved BOB planes | Structured image noise | Confirm physical layouts from the decoder/source, not familiar formats. |
| Read signed BOB coordinates as unsigned | 1,220 slots were silently dropped; close trees vanished | Treat binary field signedness as behavior, not implementation detail. |
| Ignored BOB header control | Floors and walls were mirrored or incomplete | Similar names in binary formats can encode entirely different rules. |
| Reinstated control-3 placeholder slots after a misdiagnosis | Stray water-corner artifacts | Keep a written causal record before reversing a fix. |
| Used lit Copper colours as the base block palette | The whole scene was too bright | Reconstruct palette state at the actual raster location. |
| Sampled the first Copper write | Black banks and green artifacts | A Copper list is a sequence of state changes, not a list of final values. |
| Let the parity test reimplement its own compositor | False passes and false mismatches | Test the real production path wherever possible. |
| Tied world updates to `requestAnimationFrame` | Speed varied by display refresh rate | Use a fixed 50 Hz simulation clock. |
| Trusted test output before verifying setup | Time spent diagnosing nonexistent regressions | Test fixtures deserve the same scrutiny as game code. |

## Deliberate deviations and remaining product decisions

The finished port is source-faithful by default, but it already makes or anticipates a few intentional choices:

- Button actions are delayed, while their panel art flips immediately.
- A loose item can be previewed in the empty hand area before it is picked up.
- Music is rendered to OGG for reliable browser playback rather than replayed from MED at runtime.
- Tall trees and columns are proposed as an opt-in visibility improvement, not a change to the default parity renderer.

Future product decisions should stay equally explicit. Candidates include a “fixed source bugs” mode, more extensive monster configurations, adjustable ambient and artificial-light levels, save/load and options flow, and browser-friendly campaign conveniences.

## Recommendations for future work

1. Preserve the current regression suite as a release gate, especially the 752-view parity test.
2. Add visual snapshots from representative original footage; parity validates internal agreement, not absolute historical accuracy.
3. Build one command that regenerates all assets and runs all verification scripts in dependency order.
4. Add a debug cell inspector to make map flags, layers, variants, and ownership visible during playtesting.
5. Keep “faithful” and “improved” behavior behind named switches so future changes remain explainable.
6. Prioritise save/load/options and input parity if the goal is a complete consumer-facing release rather than a technically complete port.

## Closing perspective

The browser port proves that the original game can be carried forward without flattening what made its presentation and systems distinctive. Its technical character came from many tightly coupled, hardware-era details: bitplane math, Copper timing, source-specific formats, and rendering order. The successful approach was to preserve those semantics in a form that browsers can run and tests can defend.

The project’s most valuable output is therefore not only the playable port. It is the accumulated, executable understanding of how *Hired Guns* works: decoders, converters, renderers, tests, and documented decisions that make the next change far less mysterious than the first one.

