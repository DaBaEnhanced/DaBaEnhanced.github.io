'use strict';
// Parser for Hired Guns .map files.
//
// A .map file is a straight memory image of the game's `locn` + `map` structures
// (Sources/Equates.i), which is why every file is exactly 157738 bytes:
//
//   0        locn            542    world-map location record
//   542      map header    27476    name, starts, water, explosions, horizons,
//                                   triggers, messages, monsters, buttons,
//                                   lifts, doors, pushables, text panels
//   28018    part 1        43240    cell data      (+460-byte guard band each side)
//   71258    part 2        43240    per-player "seen" bits
//   114498   part 3        43240    items lying on the ground
//
// Each part is 23x23x20 cells of one packed 32-bit word. The 5-row guard bands
// let the view scanner read past the map edge without bounds checks.

const MAP_WIDTH = 23;
const MAP_DEPTH = 23;
const MAP_HEIGHT = 20;
const CELL_SIZE = 4;
const LEVEL_CELLS = MAP_WIDTH * MAP_DEPTH;           // 529
const PART_CELLS = LEVEL_CELLS * MAP_HEIGHT;         // 10580
const GUARD_BYTES = MAP_WIDTH * 5 * CELL_SIZE;       // 460
const PART_SIZE = PART_CELLS * CELL_SIZE + 2 * GUARD_BYTES; // 43240

const LOCN_SIZE = 542;
const MAP_FILE_SIZE = 157738;

// --- cell field layout (Sources/Equates.i) ---------------------------------
const CELL = {
	floorHere: 1 << 0,
	blockHere: 1 << 1,
	waterHere: 1 << 2,
	panelHere: 1 << 3,
	explosionHere: 1 << 4,
	auxHere: 1 << 5,
	opaque: 1 << 6,
	invisible: 1 << 7,
	pushable: 1 << 8,
};
const SHIFT = { floor: 9, block: 11, water: 17, panel: 19, explosion: 21, variant: 23, aux: 28 };
const MASK = { floor: 0x3, block: 0x3f, water: 0x3, panel: 0x3, explosion: 0x3, variant: 0x1f, aux: 0xf };

const FLOOR_TYPES = ['grass', 'button', 'lift', 'puddle'];
const BLOCK_TYPES = [
	'stone', 'push', 'fitness', 'exit', 'tree', 'repulsion', 'teleport', 'hydraulic',
	'mon1_n', 'mon1_e', 'mon1_s', 'mon1_w',
	'mon2_n', 'mon2_e', 'mon2_s', 'mon2_w',
	'stairs2_n', 'stairs2_e', 'stairs2_s', 'stairs2_w',
	'door1_ns', 'door1_ew',
	'grenade', 'stunGrenade',
	'sentry_n', 'sentry_e', 'sentry_s', 'sentry_w',
	'exgfx28', 'exgfx29', 'exgfx30', 'exgfx31',
	'p1_n', 'p1_e', 'p1_s', 'p1_w',
	'p2_n', 'p2_e', 'p2_s', 'p2_w',
	'p3_n', 'p3_e', 'p3_s', 'p3_w',
	'p4_n', 'p4_e', 'p4_s', 'p4_w',
];
const AUX_TYPES = [
	'eggClosed', 'eggOpen', 'container1', 'container2', 'container3', 'container4',
	'container5', 'deadPlayer',
	'stairs1_n', 'stairs1_e', 'stairs1_s', 'stairs1_w',
	'door1open_ns', 'door1open_ew', 'monster1dead', 'monster2dead',
];

function decodeCell(v) {
	return {
		raw: v >>> 0,
		floorHere: !!(v & CELL.floorHere),
		blockHere: !!(v & CELL.blockHere),
		waterHere: !!(v & CELL.waterHere),
		panelHere: !!(v & CELL.panelHere),
		explosionHere: !!(v & CELL.explosionHere),
		auxHere: !!(v & CELL.auxHere),
		opaque: !!(v & CELL.opaque),
		invisible: !!(v & CELL.invisible),
		pushable: !!(v & CELL.pushable),
		floorType: (v >>> SHIFT.floor) & MASK.floor,
		blockType: (v >>> SHIFT.block) & MASK.block,
		waterLevel: (v >>> SHIFT.water) & MASK.water,
		panelType: (v >>> SHIFT.panel) & MASK.panel,
		explosion: (v >>> SHIFT.explosion) & MASK.explosion,
		variant: (v >>> SHIFT.variant) & MASK.variant,
		aux: (v >>> SHIFT.aux) & MASK.aux,
	};
}

// --- string helpers --------------------------------------------------------
/** The game's text uses 0xFB/0xFC control bytes; strip them for plain reading. */
function readText(buf, off, len) {
	let s = '';
	for (let i = 0; i < len; i++) {
		const c = buf[off + i];
		if (c === 0) break;
		if (c === 0xfb) { i += 4; continue; } // 0xFB <w> <w> 0xFC = layout control
		if (c === 0xfc) continue;
		s += String.fromCharCode(c);
	}
	return s.replace(/~+$/, '').trim();
}

function parseLocn(buf) {
	let o = 0;
	const u16 = () => { const v = buf.readUInt16BE(o); o += 2; return v; };
	const u8 = () => buf[o++];
	const i8 = () => buf.readInt8(o++);
	const loc = {
		x: u16(), y: u16(), hitWidth: u16(), hitHeight: u16(),
		players: u8(), typeFlag: u8(),
	};
	loc.legend = readText(buf, o, 51); o += 51;
	loc.legend2 = readText(buf, o, 132); o += 132;
	loc.legend3 = readText(buf, o, 67); o += 67;
	loc.info = readText(buf, o, 265); o += 265;
	loc.disk = u8();
	loc.mapNum = u8();
	loc.pictureNum = i8();
	loc.musicNum = i8();
	loc.atmos = i8();
	loc.mons1 = i8();
	loc.mons2 = i8();
	loc.sky = i8();
	loc.style = i8();
	loc.destinations = [];
	for (let i = 0; i < 8; i++) { const d = u8(); if (d) loc.destinations.push(d); }
	return loc;
}

function parseHeader(buf, base) {
	let o = base;
	const u8 = () => buf[o++];
	const i8 = () => buf.readInt8(o++);
	const u16 = () => { const v = buf.readUInt16BE(o); o += 2; return v; };
	const pos3 = () => ({ x: u8(), y: u8(), floor: u8() });

	const h = {};
	o += 8; // `name` (2 longs, unused at runtime)
	h.nameText = readText(buf, o, 120); o += 120;
	h.starts = [pos3(), pos3(), pos3(), pos3()];
	h.exit = pos3();
	h.timeLimit = u8();            // 1 unit = 10 seconds
	h.waterLevel = u16();
	h.lowWaterLevel = u16();
	h.hiWaterLevel = u16();
	o += 2;                        // unused (was initial water direction)
	h.waterSpeed = u16();

	h.explosions = [];
	for (let i = 0; i < 32; i++) {
		const e = {
			posn: u16(), direction: i8(), speed: u8(), count: u8(),
			colour: u8(), density: u8(), decay: u8(), flameback: i8(),
		};
		o += 5;                      // expl_unused
		e.damage = u16();
		h.explosions.push(e);
	}

	h.horizonsOffset = o;          // 4 x 144x32 single-bitplane strips
	o += 576 * 4;

	h.textTriggers = [];
	for (let i = 0; i < 50; i++) {
		const posn = buf.readUInt32BE(o); o += 4;
		const offset = buf.readUInt16BE(o); o += 2;
		// trigger_posn is a byte offset into map_data1, compared against each
		// player's mem_position (Main.s:567). Cells are 4 bytes wide.
		if (posn) h.textTriggers.push({ posn, offset, cell: posn >>> 2 });
	}
	o += 4;                        // eod5

	// The message pool is 3KB of variable-length records, indexed by the byte
	// offset a trigger carries -- not three 1KB blocks. Each record is
	//
	//   0..7   scroll_node_prec / scroll_node_succ, zero on disk
	//   8..    the text, NUL-terminated, record padded to an even boundary
	//
	// and within the text (Miscroutines.s:4183, Main.s:594):
	//
	//   text[3]  byte 27, the marker that introduces a speaker
	//   text[4]  the speaker gate -- '1'-'4' means only that player triggers
	//            it, anything above '4' means anyone, and '6' additionally
	//            gets rewritten to the triggering player's digit
	//
	// count_participants counts every 27 in the record; push_msg then shows
	// the message only while participants + 1 <= players_alive, which is how
	// the 1pl/2pl/3pl action maps gate their conversations.
	h.textMessagesOffset = o;
	// Only the offsets triggers actually name. The rest of the 3KB pool is
	// uninitialised memory that happens to have been saved with the map, and
	// walking it end to end decodes that junk as if it were dialogue.
	h.textMessages = readMessagePool(buf, o, 3 * 1024,
		h.textTriggers.map((t) => t.offset));
	o += 3 * 1024;

	h.monsters = [];
	const monstersBase = o;
	const MONSTER_SIZE = 22;
	for (let i = 0; i < Math.floor(2048 / MONSTER_SIZE); i++) {
		const m = monstersBase + i * MONSTER_SIZE;
		const type = buf.readUInt32BE(m);
		const posn = buf.readUInt32BE(m + 4);
		if (!type && !posn) continue;
		h.monsters.push({
			type, posn,
			fitness: buf.readUInt16BE(m + 8),
			direction: buf.readInt8(m + 10),
			x: buf[m + 11], y: buf[m + 12], floor: buf[m + 13],
			count: buf[m + 14], white: buf[m + 15],
		});
	}
	o = monstersBase + 2048;
	o += 4;                        // eod1

	// Button data fields are byte offsets from the MAP base, and which table
	// they point into depends on the action, so the table origins are recorded
	// here for the runtime to resolve them against.
	h.buttonsOffset = o - base;
	h.buttons = [];
	for (let i = 0; i < 32; i++) {
		const b = {
			used: buf.readInt8(o), actionIn: buf[o + 1], actionOut: buf[o + 2],
			dataIn: buf.readUInt32BE(o + 4), dataOut: buf.readUInt32BE(o + 8),
			// button_pad1. Zero in all 573 buttons of all 47 shipped maps, so it
			// is free for the port to use as a per-button delay, in TENTHS of a
			// second, with 0 meaning "take the global default".
			delay: buf[o + 3],
		};
		o += 28;
		if (b.used) h.buttons.push({ index: i, ...b });
	}

	h.liftsOffset = o - base;
	h.lifts = [];
	for (let i = 0; i < 32; i++) {
		const l = {
			posn: buf.readUInt16BE(o), height: buf[o + 2], minHeight: buf[o + 3],
			maxHeight: buf[o + 4], direction: buf[o + 5], weight: buf[o + 6],
			up: buf[o + 7], down: buf[o + 8], automove: buf[o + 9],
		};
		o += 10;
		if (l.posn) h.lifts.push({ index: i, ...l });
	}
	o += 2;                        // eod2

	h.doorsOffset = o - base;
	h.doors = [];
	for (let i = 0; i < 32; i++) {
		const d = {
			posn: buf.readUInt16BE(o), trig: buf[o + 2], direction: buf[o + 3],
			type: buf.readUInt32BE(o + 4), delay: buf.readInt8(o + 8),
			delCount: buf[o + 9], key: buf[o + 10], buttonOnly: buf.readInt8(o + 11),
		};
		o += 12;
		if (d.posn) h.doors.push({ index: i, ...d });
	}
	o += 2;                        // eod3

	h.pushablesOffset = o - base;
	h.pushables = [];
	for (let i = 0; i < 32; i++) {
		const p = { posn: buf.readUInt16BE(o), cell: buf.readUInt32BE(o + 2) };
		o += 6;
		if (p.posn) h.pushables.push({ index: i, ...p });
	}
	o += 2;                        // eod4

	h.textPanelsOffset = o;        // 36 panels, 48x40, 2 bitplanes each
	o += 36 * 480;

	h.headerEnd = o;
	// map_data1 sits in the same rsreset as the header, after map_buffer1
	// (MAP_WIDTH*5 cells). Button data for the floor and block actions is an
	// offset from the map base, so it needs this origin to resolve to a cell.
	h.mapDataOffset = (o - base) + MAP_WIDTH * 5 * 4;
	return h;
}

/** Read one cell part as a flat Uint32Array of PART_CELLS words. */
function readPart(buf, partBase) {
	const out = new Uint32Array(PART_CELLS);
	const dataBase = partBase + GUARD_BYTES;
	for (let i = 0; i < PART_CELLS; i++) out[i] = buf.readUInt32BE(dataBase + i * 4);
	return out;
}

const SPEAKER_MARK = 27;
const TEXT_AT = 8;              // scroll_node_text

/**
 * Decode the message pool into records keyed by the byte offset triggers use.
 * Offsets not referenced by any trigger are still decoded -- a record is
 * whatever starts at an offset, and the pool is walked end to end.
 */
function readMessagePool(buf, base, size, offsets) {
	const out = {};
	const wanted = new Set(offsets || []);
	for (const o of wanted) {
		if (o < 0 || o + TEXT_AT >= size) continue;
		let end = o + TEXT_AT;
		while (end < size && buf[base + end] !== 0) end++;
		const len = end - (o + TEXT_AT);
		if (len > 0) {
			const bytes = buf.subarray(base + o + TEXT_AT, base + end);
			let participants = 0;
			for (const c of bytes) if (c === SPEAKER_MARK) participants++;
			out[o] = {
				// Keep the marker visible as  so the renderer can find the
				// speaker positions without re-scanning bytes.
				text: Array.from(bytes, (c) => String.fromCharCode(c)).join(''),
				speaker: bytes.length > 4 ? String.fromCharCode(bytes[4]) : '',
				participants,
			};
		}
	}
	return out;
}

function parseMap(buf) {
	if (buf.length !== MAP_FILE_SIZE) {
		throw new Error(`expected ${MAP_FILE_SIZE} bytes, got ${buf.length}`);
	}
	const locn = parseLocn(buf);
	const header = parseHeader(buf, LOCN_SIZE);
	const partBase = LOCN_SIZE + (header.headerEnd - LOCN_SIZE);
	return {
		locn,
		header,
		cells: readPart(buf, partBase),
		seen: readPart(buf, partBase + PART_SIZE),
		items: readPart(buf, partBase + PART_SIZE * 2),
	};
}

const cellIndex = (x, y, floor) => floor * LEVEL_CELLS + y * MAP_WIDTH + x;

module.exports = {
	parseMap, decodeCell, cellIndex, readText,
	MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, PART_CELLS, PART_SIZE,
	GUARD_BYTES, LOCN_SIZE, MAP_FILE_SIZE, CELL, SHIFT, MASK,
	FLOOR_TYPES, BLOCK_TYPES, AUX_TYPES,
};
