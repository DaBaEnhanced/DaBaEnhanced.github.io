---
layout: page
title: "Rebuilding Alien Breed 3D from the source that almost survived"
categories: jekyll update
---

## A technical postmortem of an Amiga-to-HTML/JavaScript port

This is the fourth project in the sequence documented by
`MENACE_POSTMORTEM.md`, `SAINTDRAGON_POSTMORTEM.md`, and
`BREATHLESS_POSTMORTEM.md`. Alien Breed 3D occupies an awkward middle ground
between them.

Saint Dragon had no source and had to be reconstructed from a protected disk
and an anonymous executable. Breathless had a complete, coherent source tree
and could mostly be translated. Alien Breed 3D had source code, but not one
clean source tree that could simply be built. Its code survives dispersed
through the Alien Breed 3D II release, copied into several historical variants,
mixed with later-game material, and separated from assets that were embedded
in or loaded by the retail executable.

An earlier extraction under `alienbreed3d2_CPORT/ab3d/` made the first game much
easier to inspect, but it did not produce a compilable retail build. The
WHDLoad installation supplied missing media, while the unpacked retail AGA
executable supplied decisions that the source snapshots contradicted or did
not contain at all.

The result is a native browser game, not an emulator embedded in a page. The
runtime is HTML and JavaScript. A small 68000 core is used only at build time to
run the exact released `=SB=` decrunch routine over retail data. The generated
`web/` directory is otherwise self-contained.

The principal lesson was more severe than in the Breathless project:

> Source code is evidence, not immunity from reverse engineering.

When several source snapshots, a retail executable, recovered files, and a
packaged screenshot disagree, the task is not ordinary porting. It is source-
assisted reconstruction.

---

## Executive summary

| Recovered component | Result |
|---|---:|
| Retail campaign | 16 / 16 levels, A through P |
| Parsed world geometry | 2,496 zones, 11,190 edges, 5,692 points |
| Visibility data | 49,797 ordered room entries, 47,301 clip records |
| Render streams exercised | 7,628 walls, 5,116 active planes |
| Object records | 2,885, including fixed projectile/spawn pools |
| Dynamic geometry | 123 doors, 61 lifts, 424 wall bindings |
| Per-level dynamic slots | 21 water slots and 8 switch slots |
| Graphics | 14 wall banks, 16 floor tiles, 14 object atlases, 18 object palettes |
| Audio | 28 retail slots; 27 populated effects and one deliberate null slot |
| Browser engine | 11,820 physical lines of JavaScript in 15 modules |
| Extraction/diagnostic tools | 3,857 lines of Python/Node in 21 files |
| Verification | 371 tests across 25 files |
| Provenance | 189 source inputs and 154 generated files hashed |
| Runtime dependencies | None after the static `web/` package is built |

The campaign now includes the retail title flow, controls and password system,
all sixteen levels, moving geometry, pickups, weapons, enemy classes, bosses,
projectiles, explosions, audio, death, level transitions, and the ending.

There are three deliberately separated display modes:

- **Original** reproduces the 96x80 Copper-chunky source image, the visible
  79-row hardware handoff, 2x2 expansion, attached border sprites, and cockpit.
- **Sharp Port** keeps the same game and view but renders square browser pixels.
- **Enhanced 320x180** is explicitly a browser presentation option with wider
  horizontal vision, vertical look, and a rearranged UI.

The latter two are not represented as original game behavior. Neither are the
CRT filter, fullscreen controls, mobile touch adapter, persistence wrapper, or
optional cheats.

---

## The awkward kind of source release

The extracted AB3D directory contains 109 root files. The 60 files with explicit
assembly/include extensions alone total 133,604 physical lines, before counting
the extensionless source components. That number is misleading. It is not a
single 133,604-line program. It contains alternative main programs such as
`newtwo.s`, `newtwotest.s`, `newtwoa.s`, `4000test.s`, demo, record, playback,
two-player, master, and slave builds, plus duplicated or variant handlers.

The useful one-player path is assembled through a large root file which
includes renderer, object, movement, control, display, audio, password, and
ending components. But even files with familiar names cannot automatically be
treated as retail truth:

- `newtwo.s` and `newtwotest.s` disagree about the last held-gun row;
- the extracted `anims` snapshot hardcodes every key card into the yellow panel
  destination, while retail `abd8ch` contains four distinct destinations;
- the source names older side-border assets, while the retail executable embeds
  the `newleftbord`/`newrightbord` pair actually visible in the shipped game;
- one pause-menu source variant says `FAST BUFFER`, while the retail executable
  contains `SFX QUALITY` and live code for four/eight-channel mono/stereo modes;
- a dormant transparent-wall branch is present in source but commented out,
  and the retail executable writes its flag without ever reading it.

This established an evidence hierarchy used throughout the port:

1. retail executable behavior and exact embedded bytes;
2. retail WHDLoad media and disk/CD data;
3. agreement between independent source snapshots;
4. a single source snapshot, limited to the routine and build it describes;
5. visual observation, used to formulate a question rather than invent an
   answer.

The hierarchy is not absolute. Source explains intent and gives names that raw
machine code cannot. But when a snapshot and the shipped executable disagree
about an immediate value, pointer table, or asset, the shipped program wins.

That rule eventually became the repository's standing fidelity rule: no game
behavior, visual, value, asset, control, or level rule may be filled in because
it seems plausible.

---

# The engine

## A polygon and portal world

Alien Breed 3D is not a Wolfenstein-style grid raycaster. A level contains
arbitrary signed-coordinate points, 16-byte edges, and zones with floor, roof,
upper-floor, upper-roof, water, brightness, backdrop, teleport, and sound
fields.

An edge stores a start point, a delta vector, a joined zone or `-1` for a solid
boundary, a length, signed normal bytes, and flags. Zones refer to terminated
edge and point lists. Valid relative pointers can even point backward from the
zone record, which is why treating every offset as an ordinary unsigned file
offset corrupted early parsers.

This data model buys AB3D things Breathless cannot express naturally:

- walls at arbitrary angles;
- non-rectangular rooms;
- authored portals between zones;
- separate lower and upper room slices;
- polygon objects embedded in the same painter pipeline;
- doors and lifts whose moving planes update associated wall spans.

The cost is that visibility and ordering are no longer implicit in a regular
grid.

## Visibility is authored, clipped, and sorted

Every zone is followed by a `ToListOfGraph`: an ordered list of potentially
visible rooms with connectivity masks. A separate clips stream supplies left
and right boundary-point chains for entries which need portal clipping.

At runtime, `RotateLevelPts` transforms those boundary points through the
released sine table and signed 68000 arithmetic. `NEWsetlclip` and
`NEWsetrclip` narrow the horizontal window. `OrderZones` then uses edge-side
tests and linked-list insertion to produce a far-to-near room order.

The renderer walks that result in source order:

```
current zone
  -> recovered potentially-visible room list
  -> portal clip chains
  -> OrderZones far-to-near ordering
  -> lower/upper render-command streams
  -> walls, planes, and object passes in stream order
  -> objects and polygon parts far-to-near within their pass
```

There is no browser z-buffer in the faithful path. A later command wins because
the original writes it later. This matters for coplanar switch faces, door
markings, transparent-tagged walls whose retail path is still opaque, and
several apparent "z-fighting" bugs which were actually violations of painter
order.

## The framebuffer is a Copper program

This is the most unusual part of the engine and the largest difference from
Breathless.

The source calls the view 96x80 chunky, but it is not a conventional byte-per-
pixel framebuffer followed by chunky-to-planar conversion. Each logical row is
a block of 104 Copper instructions. Most of those instructions write direct
RGB12 values into AGA colour registers. Three 32-colour passes, selected with
`BPLCON3`, provide the 96 horizontal samples. A small planar mask tells the
display which colour register appears at each screen position.

In effect, the CPU renders by rewriting the colour operands of a program that
the Copper races against the video beam.

The consequences reach surprisingly far:

- a horizontal sample is a four-byte Copper instruction, not a byte or pixel;
- a row stride is `104*4` bytes;
- walls and floors write direct RGB12 colour words into those instruction
  operands;
- two complete Copper lists are swapped and retained, not cleared each frame;
- untouched pixels therefore contain the image from two display passes ago;
- attached hardware sprites overlap the view independently of its contents;
- palette state can change partway through the border/panel handoff;
- the final allocated chunky row remains writable in memory but is not exposed
  before the retail display hands over to `COLOR00` and the cockpit.

The last point resolved one of the final reported alignment bugs. Moving the gun
down by two browser pixels looked plausible. It was wrong. Retail `abd8ch`
proved `DRAWCHUNK` ends on source row 78, and the packaged AGA screenshot matched
all 364 opaque pistol texels at the unchanged `GUNYOFFS`. The screenshot also
showed nonblack scene data across row 78 and black across all 96 samples of row
79. The correct fix was to preserve row 79 in Copper memory while hiding it at
display expansion.

## Walls are subdivided fixed-point programs

A wall is not projected once and linearly sampled with JavaScript floats.
`walldraw` recursively builds endpoint and midpoint records, selecting a
subdivision count from depth difference and nearest depth. The recovered
`iterfile` determines the exact power-of-two stepping. Widths from 257 to 511
advance 512 DDA samples, even though duplicate projected columns are discarded.

Each retained column carries wrapping 16.16 values for screen X, texture U,
depth, projected top, projected bottom, and light. The vertical strip indexes a
recovered `constantfile` pair and advances texture Y through `ADD.L`/`ADDX.W`
carry behavior. Light is particularly treacherous because U and brightness are
temporarily packed into one long. A carry out of U can enter the brightness
half, after which `screendivide` sign-extends only the low byte of the swapped
light value. Treating it as a normal 16-bit integer produced the black stripes
that looked like z-fighting on otherwise valid walls.

Even the projected bottom is stateful. The first positive wall record uses
vertical origin 40; every following right endpoint uses origin 41 and becomes
the next span's retained left bottom. Recomputing every span independently
created a one-row seam at each subdivision boundary.

These details are ugly in JavaScript. They are not accidental complexity in the
port. They are the observable behavior of compact 68000/AGA code.

## Floors are scanline tables, but not generic polygon fills

`itsafloordraw` clips a plane against a near distance derived from the plane's
height relative to the camera and the active top or bottom clip. It then builds
`leftsidetab` and `rightsidetab` through four asymmetric signed-word edge loops.
Rising and falling edges do not share one generic inclusion rule. Floors begin
from Copper record 41, roofs from record 40, and the right edge becomes
exclusive only after an explicit increment.

`FloorLine` reconstructs texture coordinates as packed six-bit U/V values. It
uses signed sine/cosine multiplies, register-count shifts, clipped-left
multiplication, word additions, and carry-fed long additions. Gouraud floors add
another fixed-point brightness DDA into a recovered fifteen-row lookup.

Water is a separate scanline program. It offsets the packed floor coordinate,
uses a sine-displaced read from an existing framebuffer row, combines that
pixel's low RGB12 byte with the water table's high byte, and applies a distance
lookup. The complete retained brighten table is 11,264 bytes; the maximum legal
lookup lands on its final word. An earlier 8,192-byte extraction was shifted by
3,072 bytes and made distant water sample unrelated workspace colours. Locating
the full source file inside the retail executable fixed the symptom without a
clamp or invented palette rule.

## Objects are both data and mutable programs

The object table contains 2,885 fixed 64-byte records across the campaign.
Different handlers reuse the same offsets for enemy state, pickup fields,
projectile velocity, animation, collision, pool linkage, and temporary values.
The two 20-record projectile pools and the adjacent `OtherNastyData` spawn pool
are not inferred from type names; their pointers come from the level header.

`ObjectHandler` walks the records once in address order. This ordering is game
behavior:

- damage is consumed before the next record runs;
- a barrel can blast a later object in the same pass;
- a tree can reuse a later spawn slot which then runs later in that same walk;
- brightness changes affect later handlers but not records already visited;
- `GraphicRoom` is copied before the `worry` test even for dormant records.

An early browser architecture split enemies, shots, damage, and pickups into
separate subsystem passes. Each pass was reasonable in isolation, but together
they could not reproduce the source transaction order. The final simulation
uses the single recovered walk.

## Collision is a stateful traversal, not a radius test

`MoveObject` is shared by the player, enemies, bullets, and blast debris, with
caller-specific global parameters. It walks primary and secondary wall lists,
tests finite edge extents, checks vertical openings, follows portals, records
rooms in a persistent `RoomPath`, writes wall-contact category bits, and applies
the source `.calcalong` wall projection.

This explains several bugs which resisted local fixes:

- manual doors do not open because the player is within an invented radius;
  they consume a player-contact bit written by `MoveObject`, plus Space for the
  appropriate mode;
- some lifts can be operated from an exterior bound wall because their starting
  height makes standing inside them impossible;
- the player's 40-unit `extlen` is an operand in the wall-normal expression,
  not a circular collision hull;
- source wall sliding replaces coordinate high words while preserving proposed
  16.16 fractions;
- negative coordinates require arithmetic-floor high words, not truncation
  toward zero;
- door, alien, and bullet contact all share wall flag storage and consumption
  order.

The notorious fixed-world-X drift came from mishandling the high and low halves
of a negative 16.16 coordinate. It was not intentional inertia. The real
inertia remains in separately stored world-axis velocity words: the current
view angle affects new acceleration, while already accumulated velocity keeps
its world direction as it decays.

## Dynamic geometry is pointer-linked

Doors and lifts contain live heights, velocities, conditions, activation modes,
and terminated lists of wall bindings. Those bindings point back into render
commands and mutable collision edges. Opening a door is therefore not merely
changing a sector height. One update changes the moving plane, room opening,
collision, wall span, texture-pointer scroll, and sound/contact state together.

Switches similarly point into wall command data and select an adjacent texture
frame in `switches.wad`. Coloured key markings are not generated badges. They
are inactive polygon-object records recovered from the retail executable and
painted in the ordinary object pass.

This is less abstract than Breathless's effect VM. It is also more tightly tied
to in-memory structure: data records point into other loaded records, and code
mutates those targets directly.

## Audio is another executable state machine

The retail data exposes 28 effect slots, of which 27 contain samples and
`Munch` is deliberately null. `MakeSomeNoise` does integer distance attenuation
and stereo placement, then schedules one of the released channel records with
identity, priority, tie-order, and replacement rules.

The unpacked executable also resolved the four/eight-channel mono/stereo pause
selector. The optional eight-channel path is not eight independent hardware
voices. It mixes logical pairs in 200-byte blocks into four fixed Paula routes,
with replacement becoming audible only at a block boundary. The browser uses
an AudioWorklet to reproduce that cadence and keeps the source's curious
initialized/channel-end sample-6 stream.

As with rendering, a generic modern abstraction initially erased behavior. A
list of Web Audio voices was not equivalent to the source allocator. Identity
suppression, asymmetric volume writes, equal-priority tie order, and block
boundaries all mattered.

---

# Alien Breed 3D versus Breathless

The projects look similar from outside: both are late commercial Amiga first-
person shooters, both use 68020 assembly, both have variable-height floors and
ceilings, indexed texture art, palette-based lighting, object sprites, doors,
lifts, projectiles, and 50 Hz simulation.

Internally they solve almost every important problem differently.

| | Alien Breed 3D | Breathless |
|---|---|---|
| World model | arbitrary point/edge zones | fixed 128x128 grid of 64-unit cells |
| Wall angles | arbitrary | axis-aligned only |
| Visibility | authored room PVS, portal clips, `OrderZones` | DDA ray march through the grid |
| Per-column structure | subdivided wall strips in painter order | up to 32 crossed block records in a vtable |
| Floor/roof drawing | polygon side tables and packed scanline DDA | spans deferred from each ray column |
| Main render target | direct RGB12 operands in cycle-raced Copper lists | chunky 8-bit index buffer |
| Display conversion | Copper colour-register program plus planar mask | 981-line chunky-to-planar conversion |
| Default source view | 96x80, visibly 79 rows, expanded 2x2 | selectable up to 320x200 with four pixel modes |
| Lighting | direct RGB12 lookup tables selected during rasterization | 32x256 palette-index remap tables |
| Moving geometry | pointer-linked door/lift records mutate planes and walls | effect VM edits grid block heights |
| Game objects | one address-ordered 64-byte record walk | more separated object/effect systems |
| Surviving source | many duplicated and conflicting historical variants | one coherent 22-file source tree |
| Runtime port boundary | preserve several 68000 arithmetic/raster machines | translate a cleaner grid renderer and discard c2p |

## Which engine is more sophisticated?

That question has no single answer.

AB3D's geometry is more general. Arbitrary wall angles, authored portals,
upper/lower room slices, polygon objects, and painter-ordered command streams
allow spaces a fixed grid cannot describe. Its renderer is a remarkable use of
the AGA Copper as a direct-colour pixel machine.

Breathless is more systematic. Its grid makes visibility, collision, doors,
and moving heights regular. The per-column vtable is an elegant single data
structure from which walls, steps, floors, ceilings, and sprite clipping can be
derived. Its resolution scaling is genuinely parameterized rather than built
around one 96x80 hardware race.

AB3D spends complexity to escape the grid and to avoid a conventional c2p
pipeline. Breathless accepts the grid and pays the c2p cost. Both choices make
sense for their respective games.

## Which source is cleaner?

Breathless, decisively—but this comparison mixes code quality with preservation
quality.

The Breathless source is one internally coherent program with consistent
structures and comments. The AB3D corpus resembles a working development disk:
alternative main files, copied handlers, `.bak` versions, demo and two-player
forks, commented-out branches, source logical paths, embedded binary includes,
and routines whose live retail version can differ from every conveniently
named text file.

The AB3D engine also relies more heavily on shared globals and temporal
contracts. Values such as `extlen`, `awayfromwall`, `wallflags`, `RoomPath`,
`TempFrames`, `worry`, and reused object fields mean different things at
different points in the outer pass. A routine's output is often not a return
value but a mutation which another routine consumes later.

That style is not simply carelessness. It saves memory, avoids copies, and fits
a highly optimized assembly program. But it is hostile to local reasoning. A
JavaScript function can look correct while violating the call order, stale
memory, register width, or shared-global lifetime that made the assembly work.

Breathless taught us not to confuse readable source with understood behavior.
AB3D added another warning: do not confuse *available* source with the source of
the retail binary.

---

# How the recovery proceeded

## Phase 1: establish a trustworthy asset pipeline

The first task was not rendering. It was proving that every browser asset could
be derived reproducibly from retained evidence.

Retail files use both RNC ProPack method 1 and `=SB=` Data Cruncher wrapping,
sometimes nested. RNC was implemented with header, packed CRC, unpacked CRC,
and block-count validation. Rather than rewrite the undocumented `=SB=` codec
from appearances, the build executes the exact 2,508-byte `decomp4.raw` 68000
routine in a bounded vendored CPU core.

The same bounded execution also retains the decompressor's exact scratch image
for source-memory auditing instead of silently replacing it with clean storage.

Every input, tool, and generated output receives a deterministic SHA-256 entry
in `web/assets/provenance.json`. The original archives are never modified.

## Phase 2: recover all sixteen level formats

The level exporter established exact pointer and byte-consumption rules for the
main data, graphics, clips, objects, render streams, and dynamic tables. It
validates every pointer, reference, command type, terminator, and table bound.

The key achievement was to keep raw evidence and interpretation separate. The
browser manifests preserve source offsets and raw fields alongside names. A
later correction can change the interpretation without silently rewriting what
was recovered.

## Phase 3: make the renderer plausible

The first browser renderer established the big picture: walls, floors, roofs,
backdrops, sprites, cockpit, and all sixteen levels. It was enough to navigate
and enough to expose the next class of errors.

It was not yet a source port. It used continuous projections, a depth guard,
generic polygon filling, reconstructed texture coordinates, and modern notions
of near clipping. Those choices produced exactly the reports one would expect:
white sky at polygon edges, black wall bars, coplanar button flicker, missing
rooms, sprites in floors, and apparent z-fighting.

The eventual solution was not more epsilon tuning. It was to port the original
integer raster machines: wall subdivision, side tables, constant files,
endpoint ownership, packed texture stepping, painter order, and retained Copper
memory.

## Phase 4: port the simulation as one ordered machine

Movement, doors, weapons, and a subset of enemies came next. Again, plausible
browser abstractions were useful scaffolding but poor final specifications.

Collision circles, axis-separated retries, door proximity, subsystem update
passes, floating normalization, and generic projectile tests were replaced by
`MoveObject`, `Collision`, `CanItBeSeen`, `HeadTowards`, `CalcDist`,
`ShotRoutine`, and the address-ordered `ObjectHandler` walk.

The fidelity pass ultimately covered every placed enemy in the campaign, all
door and lift records, both projectile pools, pickups, teleporters, gas pipes,
the Level H robot, Level P's Big Claws, explosion fragments, barrel chains, and
the complete level-transition/ending flow.

## Phase 5: use the retail executable to resolve history

Several visible problems could not be resolved from source filenames alone.
The unpacked AGA executable became a searchable binary oracle.

Unique byte sequences and data anchors recovered:

- the retail held-gun last-row immediate;
- four distinct cockpit key-mask destinations;
- the actual attached border sprites and gauge strips;
- the scanline `healthpal` table;
- object palettes preceding the known `TextureMaps` block;
- the retail pause-menu strings and selector code;
- sound allocator defaults and channel tables;
- polygon descriptors absent from the convenient media tree;
- the relocated `RoomPath`/`RoomPathPtr` adjacency involved in one pathological
  overrun.

This is where the project stopped being "compile the old source for the web"
and became a reconstruction of one shipped executable from several ancestors.

## Phase 6: turn visual complaints into pixel-addressed tests

The packaged AGA screenshot became far more valuable once its nearest-neighbor
game image was located exactly. It now verifies the panel, border sprites,
dynamic gauges, scanline palette state, backdrop row phase, held-gun texels,
and final hidden source row byte for byte.

The renderer also gained deterministic BMP capture, frame diffing, source-pixel
writer tracing, bounded camera matching, backdrop-marker matching, warm-up of
the two stale Copper buffers, and all-level heading sweeps.

A report such as "there is a white line above this wall" can now be reduced to:

1. the exact output pixel;
2. the corresponding 96x80 source coordinate;
3. the render command that last wrote it—or failed to;
4. the source routine and fixed-point branch controlling that command;
5. an image or arithmetic regression which distinguishes the fix from a new
   approximation.

## Phase 7: build a complete browser delivery shell

`play.html` supplies the full campaign without the recovery-lab sidebar. It
supports keyboard/mouse, digital gamepad, Breathless-style two-stick touch
controls, fullscreen UI buttons, title/menu flow, passwords, death, level
advance, and ending.

Browser aliases are kept outside the game model. WASD, C for crouch, Ctrl or
click for fire, Shift for run, and relative mouse movement feed the released
actions. Focus loss, page hiding, pointer cancellation, and capture loss clear
adapter-held state so a missing browser key-up cannot become a fictional Amiga
input.

---

# The coolest findings

## 1. The Copper list is the chunky framebuffer

Most Amiga ports discard the original Copper setup after extracting palette and
display dimensions. Here that would discard the renderer's memory model. The
104-instruction row, three colour-bank passes, double-buffer lifetime, and
cycle-level panel handoff all affect visible pixels.

## 2. The game intentionally retains two-frame-old pixels

Both Copper buffers are initialized once and swapped. Neither is cleared per
frame. If no later painter command overwrites a word, it retains the image from
the last time that same buffer was active—two displayed passes earlier.

What initially looked like a missing clear was part of the released program.
The diagnostic capture tool can warm both buffers at one camera, move to
another, and isolate exactly those retained words.

## 3. A door button is a collision side effect

Manual door logic does not search for the nearest door. `MoveObject` writes a
category bit into every contacted wall record, even in some cases where the
final movement is not blocked. `DoorRoutine` later consumes that mutable word
and optionally combines it with the Space tap.

This is why increasing a player radius could fix wall peeking and break doors
at the same time: the invented shape changed the transaction that supplied the
door's real input.

## 4. Door key markings are ordinary polygon objects

The coloured jamb indicators are width-255 inactive records. A renderer that
assumes inactive objects must not draw erases them. A port that notices the
missing information and adds a `PASS` badge invents the wrong art. The retail
executable's polygon descriptors, texture maps, and palette contain the answer.

## 5. Never infer an embedded table's size from a convenient boundary

The source labels `brightentab`, `WorkSpace`, and `waterfile` consecutively but
does not state the included brighten file's size. The first recovery assumed
8,192 bytes by subtracting the workspace from the known water address. The
retained `oldbrightenfile` is actually 11,264 bytes and occurs uniquely in the
retail executable. The water table's maximum red byte is 9, making the largest
capped address `12*512 + $09ff*2 = 11262`: exactly its final word. What looked
like an intentional cross-allocation read was a shifted extraction and produced
isolated false colours in distant water. Direct file and executable evidence
must outrank a tidy inferred allocation size.

## 6. A source field may preserve yesterday's unrelated value

Pool allocation writes only named fields. The rest of the reused 64-byte record
survives. Projectiles preserve velocity low words; spawned eyeballs preserve
unwritten state; instant miss effects can inherit layer bytes. Initializing a
JavaScript object "cleanly" manufactures state the original never wrote.

## 7. The last display row exists but is not seen

The rasterizers can populate source row 79. The Copper allocation retains it.
The retail capture does not display it. This is a perfect example of why memory
state, source loop bounds, and visible pixels are three different questions.

## 8. One unresolved bug depends on a lost load address

A zero-length `FindCloseRoom` probe before any completed movement scans fresh
zero-filled `RoomPath` beyond its 100-word allocation. The next value in retail
memory is the relocated `RoomPathPtr`. Its words depend on the executable's
historical load base, which is not preserved in the available media.

Normal stale-buffer behavior is recovered. The startup-only overrun remains an
explicit error because choosing a convenient terminator would invent history.

---

## What went well

### Exact extraction paid for itself repeatedly

CRC validation, precise parser consumption, retained native texture formats,
source offsets in manifests, and global provenance meant that later visual bugs
could be investigated without doubting the asset pipeline first.

### Independent evidence resolved source conflicts

The strongest conclusions have at least two routes:

- assembly routine plus retail opcode sequence;
- source table plus unique executable byte anchor;
- decoded asset plus packaged screenshot;
- isolated arithmetic test plus all-level descriptor census.

The gun boundary, border alignment, backdrop phase, key positions, wall-bottom
origin, and pause selector all benefited from this approach.

### The user feedback loop was indispensable

The user repeatedly identified properties which broad automated checks did not:

- horizontal pixels appeared doubled incorrectly;
- sprites sat partly inside floors;
- collision allowed wall peeking;
- doors after the first one did not operate;
- aliens failed to damage the player;
- key markings and gibs differed from retail;
- polygon seams exposed sky or another room;
- wall strips turned black;
- movement acquired a fixed-axis drift;
- the original gun appeared two output pixels lower.

Several initial explanations were wrong. The reports were still right. The
productive response was to distrust the current model, locate the relevant
source transaction, and construct a narrower oracle.

### Expensive bugs produced reusable instruments

Renderer regressions led to source-pixel tracing and deterministic frame
diffing. Door regressions led to all-record activation tests. Enemy regressions
led to address-order and all-placed-enemy traversals. Executable ambiguity led
to unique-byte and offset tests. Browser failures led to static-deployment and
input-lifecycle tests.

The project became easier near the end because it accumulated ways to ask
better questions.

---

## What was hard

### Too many numeric domains were valid at once

AB3D uses, among other representations:

- signed coordinate words;
- signed 16.16 positions and velocities;
- 25.7 projected side values;
- doubled rotated depth words;
- quarter-world plane heights;
- 8.8 and 16.16 room heights;
- packed five-bit wall texels;
- packed six-bit floor U/V;
- direct RGB12 words;
- browser RGBA bytes;
- source rows, doubled output rows, hardware raster rows, and panel-relative
  rows.

A value could be perfectly reasonable and still belong to the wrong domain.
Many severe bugs were scale errors, signed-width errors, or boundary ownership
errors rather than bad high-level algorithms.

### JavaScript numbers conceal 68000 behavior

The source depends on overflow and processor flags:

- `NEG.W $8000` remains `$8000`;
- `DIVS`/`DIVU` overflow leaves the destination register unchanged;
- divide by zero raises rather than yielding infinity;
- `ADD.W` can feed `ADDX.L` carry;
- `EXT.W` sign-extends a byte, not a full word;
- register-count shifts use a six-bit count;
- writing a high word can deliberately retain a low fractional word.

Using `Math.abs`, ordinary division, truncation, or an unrestricted float often
produced a cleaner result than the game—and therefore the wrong result.

### Painter order makes every local fix dangerous

There is no independent depth truth to fall back on. Room order, command order,
object order, polygon-part order, inclusive/exclusive edges, and stale-buffer
contents together decide one pixel. Fixing a crack by extending a polygon can
cover a later detail. Adding a depth test can erase a coplanar switch. Clearing
the frame can remove retail stale words. Reversing UI order can fix one seam and
break the attached-sprite/panel palette handoff.

### Browser improvements needed a quarantine boundary

The user explicitly wanted square pixels, 16:9 rendering, vertical look, mobile
controls, fullscreen UI, CRT treatment, and cheats. Those are legitimate port
features, but they cannot leak back into the source renderer or be described as
retail behavior.

Maintaining Original, Sharp, and Enhanced paths made the renderer larger. It
also made the claims honest.

---

## What went badly, and why

### 1. Plausible inventions delayed the real port

Early implementations added or substituted behavior which made sense in a
modern engine:

- a 100-unit manual-door proximity radius;
- circular wall/object collision;
- axis-separated wall retries;
- a depth guard and synthetic near plane;
- a generic polygon triangle fan;
- a yellow crosshair;
- a made-up door `PASS` badge;
- browser trigonometry and Euclidean distance;
- cleanly initialized pool objects;
- subsystem-batched object updates.

Each one was defensible as game code. None was defensible as a source port.

The important failure was methodological: once a plausible substitute existed,
later fixes tended to tune it instead of questioning its legitimacy. The
standing no-invention rule was introduced to stop that pattern permanently.

### 2. Modern renderer concepts made the image less correct

A z/depth guard sounded safer than a pure painter. Continuous projection
sounded more accurate than integer DDA tables. A shared near plane sounded more
coherent than a plane-height-dependent one. Perspective-correct interpolation
sounded better than affine source polygons.

Together they produced missing coplanar details, sky cracks, black strips,
incorrect room clips, and polygon seams. Several rounds improved one artifact
while making the overall renderer visibly worse.

The correction was to stop asking how a modern renderer should fill the scene
and ask exactly which source routine owns each pixel.

### 3. A symptom often named the wrong subsystem

The gun looked two pixels high, but its coordinates were exact; the final
Copper row was hidden. Door operation looked like a reach problem, but it was a
wall-contact transaction. Fixed-axis drift looked like collision sliding, but
it was negative 16.16 high-word reconstruction. Black bars looked like missing
geometry, but one class came from extracting the wrong byte width from packed
U/light state.

User observation was a high-quality detector, not automatically a diagnosis.
The same is true of automated failure messages.

### 4. Broad tests agreed with broad approximations

A renderer could draw every level and still use the wrong edge ownership. An
enemy could move and still have the wrong collision, wake, facing, or attack
cadence. A door could open in a synthetic test and remain impossible from its
real Level A approach side.

Coverage counts are valuable, but they answer only whether a path ran. The
project improved when tests began asserting exact state transitions, retained
words, source offsets, caller order, and individual output pixels.

### 5. The browser added failures the Amiga never had

Stale module URLs made correct changes appear absent. Pointer IDs could be
reused after a lost release. Focus loss could pin a key. `Alt` and the original
letter bindings conflict with browser/desktop conventions. A rendering
exception could erase the complete game canvas while controls remained active.
The 50 Hz source camera also juddered when presented directly on 60-144 Hz
displays, and high-rate mouse events could each trigger a full software frame.

These problems required browser-side safeguards and cache versioning. Those
safeguards belong at the delivery boundary; they must not become excuses to
change the emulated game rules. Sharp modes now interpolate only between exact
completed camera states at a capped 60 fps, while Original keeps source cadence;
simulation, source visibility, and enemy wake state never see the interpolated
camera. The dense raster hot path also reuses RGB12 colours, recovered water
offsets, and plane-intersection scratch instead of feeding periodic garbage-
collector pauses. A packed RGBA framebuffer fill and elimination of an
identical second black clear removed another fixed per-frame cost without
changing any rendered byte.

### 6. The audit became enormous

`docs/FIDELITY_AUDIT.md` grew past a thousand lines because every correction
needed its source routine, exact arithmetic, scope, and regression. That is not
pleasant prose, but it is useful engineering evidence.

The mistake would be expecting one document to serve as narrative, task list,
proof ledger, and architecture guide. This postmortem exists partly to extract
the story while leaving the audit as the detailed ledger.

---

## The validation strategy that emerged

### Layer 1: file and format invariants

- RNC header and CRC validation;
- bounded execution of the released `=SB=` decoder;
- exact parser consumption and legal pointers;
- texture, palette, sprite, panel, object, and font dimensions;
- hashes for raw inputs and generated outputs.

### Layer 2: source and executable cross-checks

- named routine/table and source line range;
- unique retail opcode or byte-table anchor where snapshots disagree;
- object-frame and palette adjacency;
- live pointer targets resolving to the expected command type;
- complete corpus counts for objects, movers, and render commands.

### Layer 3: arithmetic-unit tests

- signed word/long wrapping;
- multiply-high transforms;
- `DIVS`/`DIVU` zero and overflow behavior;
- `ADD.W`/`ADDX` carry cadence;
- exact DDA endpoints and clip ownership;
- persistent low words and stale buffers.

### Layer 4: behavioral transactions

- one complete `MoveObject` traversal;
- wall flag production and door/lift consumption;
- one address-ordered `ObjectHandler` pass;
- exact enemy wake, movement, attack, damage, death, and spawn transitions;
- projectile allocation, portal crossing, impact, bounce, and pool reuse;
- title/password/death/level/ending flow.

### Layer 5: campaign-wide census

- all 16 level manifests;
- all 123 doors and 61 lifts;
- all 814 placed enemies through recovered movement lists;
- all 7,628 walls and 5,116 active planes at eight headings;
- every retail object atlas, palette, vector descriptor, and sound slot.

### Layer 6: deterministic image evidence

- source-sized BMP capture without CSS scaling;
- command tracing for one 96x80 source pixel;
- exact frame diff and heat map;
- two-buffer warm-up captures;
- bounded camera and backdrop matching;
- byte-for-byte comparison against the packaged retail screenshot.

### Layer 7: browser and human verification

- self-contained static-site tests;
- keyboard, pointer, gamepad, touch, fullscreen, and focus lifecycle;
- actual play through the shipped level geometry;
- comparison by a person familiar with the original.

The layers are deliberately redundant. A unit test can prove arithmetic while
missing call order. A campaign census can prove coverage while missing one
pixel rule. A screenshot can prove pixels while saying nothing about the next
simulation tick.

---

## Browser-only additions and why they remain separate

The clean port is not required to pretend that a 1995 input and display shell is
ideal on a current browser.

The user-requested additions are useful:

- WASD and relative mouse control;
- C crouch and Ctrl/click fire aliases;
- digital gamepad mapping;
- Breathless-style two-stick mobile controls;
- fullscreen buttons available from the game UI;
- local browser persistence around the original password;
- a togglable CRT filter;
- invulnerability and infinite-ammunition cheats;
- Sharp and Enhanced display modes;
- enhanced-only vertical look and 320x180 viewport.

The design rule is that these features adapt presentation or input delivery.
They do not silently alter Original mode or enter the saved retail password.
Controls and menus label them as port options.

Enhanced mode uses recovered art, texture data, lighting, and geometry, but its
wider frustum, movable horizon, sky-row clamp, dynamic-gauge-only side UI, and
pitched shots are browser extensions. Original mode retains the source PVS
projection, horizontal-only aim, attached sprites, cockpit, 2x2 raster, and
Copper display boundaries.

---

## The final architecture

```
tools/
  rnc.py                    validated RNC1 decompression
  sb_unpack.js              bounded 68000 execution of retail decomp4.raw
  build_levels.js           levels, PVS, clips, render streams, dynamics
  build_textures.js         packed walls, floors, water and lookup memory
  build_objects.py          WAD/PTR atlases and executable palettes
  build_vectors.py          retail polygon descriptors and texture maps
  export_panel.js           panel, keys, attached sprites and Copper palettes
  build_audio.js            retail signed PCM and slot metadata
  build_fonts.js            pause/menu/ending fonts
  build_ending.js           narrative and credit records
  build_provenance.js       deterministic input/output hash inventory
  capture_source_frame.mjs  deterministic renderer capture and pixel tracing
  diff_source_frames.mjs    exact image differences and heat maps
  benchmark_browser_renderer.mjs  full-asset Sharp presentation timing
  match_retail_*.mjs        bounded retail-camera/backdrop matching

web/engine/
  geometry.js               fixed-point PVS, portal projection and room order
  renderer3d.js             Copper memory, walls, planes, objects, UI composite
  textures.js               native packed texture and RGB12 lookup sampling
  vectorObjects.js          recovered polygon descriptors
  movement.js               50 Hz player control and source velocity arithmetic
  simulation.js             ObjectHandler, movers, enemies, shots, collision
  audio.js                  MakeSomeNoise scheduling and browser delivery
  paula-stream.js           released block mixer state
  paula-worklet.js          live Paula-period playback/mixing
  frontend.js               retail title, controls and password flow
  ending.js                 final narrative and credits
  controls.js touch.js      browser adapters around released actions
  main.js                   transactional frame loop and campaign shell

web/assets/
  levels/ objects/ walls/ panel/ audio/ fonts/ ending/
  provenance.json
```

The large files are telling. `renderer3d.js` and `simulation.js` are not large
because JavaScript needs more ceremony than assembly. They are large because
the final port stopped forcing many distinct source routines through a few
generic browser abstractions.

---

## What remains uncertain

The full retail campaign is playable, but "playable" is not the same claim as
cycle-perfect in every dormant or pathological path.

- The exact historical source snapshot used for each AGA/CD32 executable is
  unknown. Retail bytes resolve individual conflicts, not the complete family
  tree.
- The startup-only zero-length `FindCloseRoom` overrun depends on a relocated
  pointer word whose historical load address is absent. Normal stale
  `RoomPath` behavior is retained; the unknowable first-probe outcome is not
  guessed.
- The source contains chunky/bumpy/arc/light-beam command families absent from
  the shipped A-P render streams. Their presence in source is documented, but
  corpus coverage cannot prove unused paths pixel-exact.
- The surviving builds may differ beyond audio and embedded assets. A routine
  proved against one retail executable must not automatically be generalized
  to every historical build.

These are preservation boundaries, not invitations to add plausible code.

---

## What we would do differently next time

### Establish the fidelity rule before the first playable frame

A rough renderer is useful, but every approximation should be labelled and
scheduled for replacement immediately. Unlabelled scaffolding hardens into an
assumed specification.

### Inventory source variants as a family, not a directory

Before porting behavior, build a table of roots, includes, hashes, differing
immediates, asset names, and known executable relationships. A filename match
is weak provenance in a duplicated working tree.

### Recover one retail frame boundary early

The exact panel position, attached-sprite start, backdrop phase, 2x scaling,
and final hidden row should have been established before tuning geometry. A
known display transform turns screenshots into byte-level oracles.

### Implement processor-width primitives once

Signed words, long wrapping, multiply-high extraction, division overflow,
register shifts, and extend-with-carry should be a small tested vocabulary used
from the beginning. Recreating them piecemeal allowed the same class of error to
recur across movement, rendering, sound, and AI.

### Preserve outer-pass order before modularizing subsystems

The source's single object walk should first be represented literally. Modules
can still organize code, but they must not reorder transactions merely because
enemies, shots, pickups, and damage look like separate domains.

### Split faithful and enhanced rendering at the projection boundary

Original mode should own integer source coordinates and Copper memory.
Presentation modes should own continuous projection and extra pixels. Sharing
half of each path caused source clip rules to leak into widened viewports and
browser interpolation to leak back into exact mode.

### Turn every expensive visual bug into a retained pixel test

If a seam costs several rounds to understand, the final test should identify
the exact pixel, writer, endpoint rule, and evidence. Otherwise the same bug can
return under a different camera angle.

---

## Closing

Breathless is the cleaner engine to explain. Its grid, vtable, span fills,
lighting maps, and c2p pass form a compact story. Alien Breed 3D is the more
surprising engine to reconstruct. It combines arbitrary polygonal rooms,
authored portal visibility, mutable pointer-linked geometry, fixed-point painter
rasters, and an AGA Copper program masquerading as a direct-colour framebuffer.

Its source is messy in two different senses. The surviving archive is messy:
duplicated roots, incompatible snapshots, missing retail media, and embedded
assets. The live program is messy in the productive assembly sense: shared
globals, overlapping records, stale memory, packed fields, and control flow
designed around exact instruction side effects.

Trying to clean those things up too early produced a smoother, more modern,
less correct game. The port improved when it stopped asking what the code
probably meant and began preserving what the released machine demonstrably
did.

That is the real contrast with Breathless. Breathless showed that having source
does not mean you have understood it. Alien Breed 3D showed that sometimes
having source does not even mean you have *the* source.
