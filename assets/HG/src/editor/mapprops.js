// The map header: everything that is one setting for the whole level.
//
// None of this lives in a cell, so nothing in the grid can show it -- and until
// it is editable a map cannot be rebuilt from scratch, only redecorated. The
// fields come from `struct map` and `struct locn` in HGmapstructure.h.
//
// The ranges are the real ones, not guesses: `style` picks one of the five
// Graphics/StyleN sets, `sky` indexes the eight sky ramps (masked to 3 bits
// where it is read), `atmos` and `musicNum` index the sample and module banks,
// and `mons1`/`mons2` say which two monster graphic sets the map loads -- a map
// can only show two, because that is how many BOB slots the style has room for.

export const STYLE_COUNT = 5;
// Sky.s ships five ramps in the `normal` table. The game masks the index to
// three bits, so 5-7 are addressable but read nothing, and the campaign uses
// 0-4 -- so five is the honest count.
export const SKY_COUNT = 5;
export const WATER_MAX = 65535;
export const TIME_LIMIT_MAX = 255;

/**
 * Editable header fields.
 *
 * `control` says whether the value is a free number or one of a fixed set --
 * every one of these except the clock and the tide is an INDEX into a table, and
 * a number box for "which of the five styles" is just a way to type 7 by
 * mistake. `preview` names what can be shown beside it; the option labels that
 * need game data (monster names, sample keys) are filled in by the caller.
 */
export const MAP_FIELDS = [
	{
		key: 'style', path: 'locn.style', label: 'style',
		min: 0, max: STYLE_COUNT - 1, control: 'select', preview: 'style',
		hint: 'Which Graphics/StyleN set draws this map: the walls, the floor, '
			+ 'the ground texture and the door frames. There is exactly one ground '
			+ 'texture per style, so this is the only way to change how the ground '
			+ 'looks -- there is no per-cell grass-vs-path choice.',
	},
	{
		key: 'sky', path: 'locn.sky', label: 'sky',
		min: 0, max: SKY_COUNT - 1, control: 'select', preview: 'sky',
		hint: 'Which colour ramp the sky and horizon are drawn against. One ramp '
			+ 'is 44 colours, one per view row, and the copper walks it down the '
			+ 'screen as you look up and down.',
	},
	{
		key: 'atmos', path: 'locn.atmos', label: 'ambience',
		min: 0, max: 7, control: 'select', preview: 'sample',
		hint: 'The looping background sample, loaded as Atmos/AtmosNN.sfx. This is '
			+ 'the room tone -- wind, machinery, dripping -- not the music.',
	},
	{
		key: 'musicNum', path: 'locn.musicNum', label: 'music',
		min: 0, max: 5, control: 'select', preview: 'music',
		hint: 'The module that plays during the mission: 0 is silence, 1-5 pick '
			+ 'Static01 to Static05. Anything outside that range plays nothing.',
	},
	{
		key: 'mons1', path: 'locn.mons1', label: 'monster set 1',
		min: 0, max: 20, control: 'select', preview: 'monster',
		hint: 'The first of the two creature graphic sets this map loads. A map '
			+ 'can only show TWO kinds of monster, because that is how many BOB '
			+ 'slots the style has room for -- so this is the real constraint on '
			+ 'what can live here, whatever the eggs say.',
	},
	{
		key: 'mons2', path: 'locn.mons2', label: 'monster set 2',
		min: 0, max: 20, control: 'select', preview: 'monster',
		hint: 'The second creature graphic set. 0 leaves the slot empty.',
	},
	// 22-Stopover ships with 0, so 0 is a real value, not a bad one.
	{
		key: 'players', path: 'locn.players', label: 'players',
		min: 0, max: 4, control: 'select',
		hint: 'How many players the level is built for. The world map uses it to '
			+ 'decide which missions your party size can take on; 0 means '
			+ 'unrestricted.',
	},
	{
		key: 'timeLimit', path: 'timeLimit', label: 'time limit',
		min: 0, max: 99, control: 'number',
		hint: 'The mission countdown, shown as two tumbler digits. It is split '
			+ 'into tens and units at load (Main.s:5104) and driven by a 600-tick '
			+ 'counter, so one unit is about twelve seconds and 99 is roughly '
			+ 'twenty minutes. When both digits reach zero the mission ends. '
			+ '0 means no limit.',
	},
	// AN ADDITION, not a field the format has. Absent means the copper's own
	// banks are used, which is what every shipped map does.
	{
		key: 'ambientMin', path: 'ambient.min', label: 'shadow',
		min: 0, max: 200, control: 'number', optional: true,
		hint: 'How much of a colour survives into UNLIT cells, as a percentage. '
			+ 'The original has no such number: its four palette banks are simply '
			+ 'four brightness levels of the same colours, and the darker pair IS '
			+ 'the shadow. Setting this re-derives them from the lit pair, so 0 is '
			+ 'pitch dark and 100 removes shadow entirely. This repaints nearly '
			+ 'everything you see. Leave it empty to use the original banks.',
	},
	{
		key: 'ambientMax', path: 'ambient.max', label: 'sunlight',
		min: 0, max: 200, control: 'number', optional: true,
		hint: 'Brightness of LIT areas, as a percentage. 100 is the original. '
			+ 'The lit banks are reached only where a light mask lands -- a wall or '
			+ 'floor patch beside stone, on a cell whose light bit is set -- so '
			+ 'this controls the highlights rather than the whole level. Raise it '
			+ 'past 100 to blow out a desert. Empty leaves the original banks.',
	},
	{
		key: 'waterLevel', path: 'water.level', label: 'water level',
		min: 0, max: WATER_MAX, control: 'number',
		hint: 'The current height of the water. Cells below it flood.',
	},
	{
		key: 'waterLow', path: 'water.low', label: 'water low',
		min: 0, max: WATER_MAX, control: 'number',
		hint: 'The lowest the tide falls to. Equal to the high mark means a still '
			+ 'water level rather than a tide.',
	},
	{
		key: 'waterHigh', path: 'water.high', label: 'water high',
		min: 0, max: WATER_MAX, control: 'number',
		hint: 'The highest the tide rises to.',
	},
	{
		key: 'waterSpeed', path: 'water.speed', label: 'water speed',
		min: 0, max: WATER_MAX, control: 'number',
		hint: 'How fast the level moves between the low and high marks. 0 holds '
			+ 'it still, whatever the marks say.',
	},
];

const byKey = new Map(MAP_FIELDS.map((f) => [f.key, f]));

function walk(meta, path, create = false) {
	const parts = path.split('.');
	let node = meta;
	for (let i = 0; i < parts.length - 1; i++) {
		if (!node[parts[i]]) {
			if (!create) return null;
			node[parts[i]] = {};
		}
		node = node[parts[i]];
	}
	return { node, leaf: parts[parts.length - 1] };
}

/**
 * An OPTIONAL field distinguishes absent from zero, because for those two the
 * difference is the whole point: no shadow setting means "use the original
 * palette banks", while a shadow of 0 means "pitch black". Absent reads as null.
 */
export function getMapField(doc, key) {
	const f = byKey.get(key);
	if (!f || !doc) return null;
	const at = walk(doc.meta, f.path);
	if (!at) return f.optional ? null : 0;
	const raw = at.node[at.leaf];
	if (f.optional && (raw === undefined || raw === null)) return null;
	return raw | 0;
}

/** Pass null to clear an optional field. @returns true if the value changed */
export function setMapField(doc, key, value) {
	const f = byKey.get(key);
	if (!f || !doc) return false;

	if (f.optional && (value === null || value === undefined || value === '')) {
		const at = walk(doc.meta, f.path);
		if (!at || at.node[at.leaf] === undefined) return false;
		delete at.node[at.leaf];
		// Drop the parent too once it is empty, so the saved JSON stays clean.
		const parent = f.path.split('.')[0];
		if (f.path.includes('.') && doc.meta[parent]
			&& !Object.keys(doc.meta[parent]).length) delete doc.meta[parent];
		return true;
	}

	const at = walk(doc.meta, f.path, true);
	if (!at) return false;
	const clamped = Math.max(f.min, Math.min(f.max, value | 0));
	if (at.node[at.leaf] === clamped) return false;
	at.node[at.leaf] = clamped;
	return true;
}

/** The map's display name, which lives in locn.legend2's first line. */
export function mapTitle(doc) {
	return String(doc?.meta?.locn?.legend2 || '').split('~')[0].trim();
}

/**
 * Header problems worth warning about. Like validateMapDoc this reports rather
 * than blocks -- a half-built map is a normal thing to save.
 */
export function checkMapProps(doc) {
	const out = [];
	if (!doc) return out;
	for (const f of MAP_FIELDS) {
		const v = getMapField(doc, f.key);
		if (v === null) continue;                      // optional and unset
		if (v < f.min || v > f.max) out.push(`${f.label} is ${v}, outside ${f.min}-${f.max}`);
	}
	const amb = doc.meta.ambient;
	if (amb && amb.min !== undefined && amb.max !== undefined && amb.min > amb.max) {
		out.push('shadow is brighter than sunlight');
	}
	const w = doc.meta.water || {};
	if ((w.low | 0) > (w.high | 0)) out.push('water low is above water high');
	if ((w.speed | 0) > 0 && (w.low | 0) === (w.high | 0)) {
		out.push('water has a speed but nowhere to move between');
	}
	const starts = doc.meta.starts || [];
	const need = getMapField(doc, 'players');
	if (need > 0 && starts.length < need) {
		out.push(`${need} players but only ${starts.length} starts`);
	}
	return out;
}
