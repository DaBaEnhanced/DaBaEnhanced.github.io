// Text triggers: a line of dialogue that fires when someone stands on a cell.
//
// Two tables, joined by a byte offset:
//
//   textTriggers[50]   { posn, offset }   posn is a BYTE offset into map_part1,
//                                         offset points into the message pool
//   text_mesgs[3*1024] the pool itself, messages packed end to end
//
// The original hand-packed those offsets. Since edited maps only need to run in
// this port, offsets are assigned here instead -- append, and reflow when
// something is deleted -- so nobody has to count bytes. The 3KB budget is still
// checked, because the pool really is that size.
//
// A message is three things (see messages.js messageFor):
//
//   text          the line, with its speaker marker baked in
//   speaker       '1'-'4' fire for that player only; above '4' anyone can,
//                 and '6' additionally rewrites the name to whoever triggered it
//   participants  how many OTHERS must still be alive: participants + 1 must
//                 fit inside the surviving party

import { cellIndex, cellOfIndex, inBounds } from './mapdoc.js';

/** Byte 27, the marker messages.js splits on. */
export const SPEAKER_MARK = String.fromCharCode(27);

export const TRIGGER_LIMIT = 50;
export const POOL_BYTES = 3 * 1024;

/**
 * Who a line belongs to.
 *
 * The gate is a character compared with '4': at or below it, only that player
 * can trigger the line; above it, anyone can. '6' is the useful one for generic
 * chatter because the name is rewritten to whoever walked in.
 */
export const SPEAKERS = [
	{ code: '1', label: 'Player 1 only' },
	{ code: '2', label: 'Player 2 only' },
	{ code: '3', label: 'Player 3 only' },
	{ code: '4', label: 'Player 4 only' },
	{ code: '5', label: 'Anyone (fixed name)' },
	{ code: '6', label: 'Anyone (names the finder)' },
];

/** Build the stored line from a speaker code and the words themselves. */
export function composeText(code, body) {
	return `   ${SPEAKER_MARK}${code} "${String(body)}"`;
}

/**
 * Pull the words back out of a stored line.
 *
 * messageFor rewrites index 4 in place for speaker '6', so the layout is fixed:
 * three spaces, the marker, the code, a space, then the quoted body.
 */
export function decomposeText(text) {
	const s = String(text || '');
	const at = s.indexOf(SPEAKER_MARK);
	if (at < 0) return { code: '6', body: s.trim().replace(/^"|"$/g, '') };
	const code = s[at + 1] || '6';
	const rest = s.slice(at + 2).trim();
	return { code, body: rest.replace(/^"|"$/g, '') };
}

/** How many bytes a message costs in the pool. */
export function messageBytes(record) {
	return (record?.text || '').length + 1;      // the line plus its terminator
}

/** Total pool use, and what is left of the 3KB. */
export function poolUsage(doc) {
	const pool = doc?.meta?.textMessages || {};
	let used = 0;
	for (const key of Object.keys(pool)) used += messageBytes(pool[key]);
	return { used, free: POOL_BYTES - used, over: used > POOL_BYTES };
}

/** The trigger on a cell, with its message, or null. */
export function triggerAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const cell = cellIndex(x, y, floor);
	const list = doc.meta.textTriggers || [];
	const at = list.findIndex((t) => (t.cell ?? (t.posn >>> 2)) === cell);
	if (at < 0) return null;
	const trigger = list[at];
	const record = (doc.meta.textMessages || {})[trigger.offset] || null;
	return { index: at, trigger, record, cell };
}

/** Every trigger, resolved to a cell, for drawing markers. */
export function triggerCells(doc) {
	return (doc?.meta?.textTriggers || [])
		.map((t) => t.cell ?? (t.posn >>> 2))
		.filter((c) => Number.isFinite(c));
}

/** The next unused pool offset, packed after everything already there. */
function nextOffset(doc) {
	const pool = doc.meta.textMessages || (doc.meta.textMessages = {});
	let end = 0;
	for (const key of Object.keys(pool)) {
		end = Math.max(end, Number(key) + messageBytes(pool[key]));
	}
	return end;
}

/**
 * Put a trigger on a cell.
 *
 * A cell can only carry one, so this replaces rather than stacking -- two lines
 * on one square would mean the second could never fire.
 *
 * @returns the trigger, or null if the table is full
 */
export function addTrigger(doc, x, y, floor,
	{ body = 'New message', speaker = '6', participants = 1 } = {}) {
	if (!inBounds(x, y, floor)) return null;
	const existing = triggerAt(doc, x, y, floor);
	if (existing) {
		setTriggerMessage(doc, existing, { body, speaker, participants });
		return existing.trigger;
	}
	const list = doc.meta.textTriggers || (doc.meta.textTriggers = []);
	if (list.length >= TRIGGER_LIMIT) return null;

	const offset = nextOffset(doc);
	doc.meta.textMessages[offset] = {
		text: composeText(speaker, body),
		speaker,
		participants: participants | 0,
	};
	const cell = cellIndex(x, y, floor);
	const trigger = { posn: cell << 2, offset, cell };
	list.push(trigger);
	return trigger;
}

/** @returns true if something was removed */
export function removeTrigger(doc, x, y, floor) {
	const found = triggerAt(doc, x, y, floor);
	if (!found) return false;
	doc.meta.textTriggers.splice(found.index, 1);
	delete doc.meta.textMessages[found.trigger.offset];
	// Offsets are ours to assign, so close the hole rather than leaving the pool
	// fragmented -- otherwise a map edited enough times runs out of a 3KB budget
	// it is barely using.
	reflowMessages(doc);
	return true;
}

/** Change a trigger's line. @returns true if anything changed */
export function setTriggerMessage(doc, found, patch = {}) {
	if (!found?.trigger) return false;
	const pool = doc.meta.textMessages || (doc.meta.textMessages = {});
	const rec = pool[found.trigger.offset]
		|| (pool[found.trigger.offset] = { text: composeText('6', ''), speaker: '6', participants: 1 });
	const cur = decomposeText(rec.text);
	const code = patch.speaker ?? rec.speaker ?? cur.code;
	const body = patch.body ?? cur.body;
	const parts = patch.participants ?? rec.participants;

	const text = composeText(code, body);
	const changed = rec.text !== text || rec.speaker !== code
		|| (rec.participants | 0) !== (parts | 0);
	rec.text = text;
	rec.speaker = code;
	rec.participants = parts | 0;
	// The line length moved, so everything after it has to shift.
	if (changed) reflowMessages(doc);
	return changed;
}

/**
 * Repack the pool so offsets run end to end in trigger order.
 *
 * @returns how many triggers moved
 */
export function reflowMessages(doc) {
	const list = doc.meta.textTriggers || [];
	const pool = doc.meta.textMessages || {};
	const rebuilt = {};
	let at = 0, moved = 0;
	for (const t of list) {
		const rec = pool[t.offset];
		if (!rec) continue;
		if (t.offset !== at) moved++;
		rebuilt[at] = rec;
		t.offset = at;
		at += messageBytes(rec);
	}
	doc.meta.textMessages = rebuilt;
	return moved;
}

/** Problems worth warning about. Reports; never blocks a save. */
export function checkMessages(doc) {
	const out = [];
	const list = doc?.meta?.textTriggers || [];
	const pool = doc?.meta?.textMessages || {};

	if (list.length > TRIGGER_LIMIT) {
		out.push(`${list.length} triggers, but the table holds ${TRIGGER_LIMIT}`);
	}
	const seen = new Set();
	for (const t of list) {
		const cell = t.cell ?? (t.posn >>> 2);
		if (seen.has(cell)) {
			const at = cellOfIndex(cell);
			out.push(`two triggers on ${at.x},${at.y},${at.floor} -- only one can fire`);
		}
		seen.add(cell);
		if (!pool[t.offset]) out.push(`a trigger points at offset ${t.offset}, which has no message`);
	}
	const usage = poolUsage(doc);
	if (usage.over) {
		out.push(`messages use ${usage.used} bytes of the ${POOL_BYTES}-byte pool`);
	}
	for (const key of Object.keys(pool)) {
		const rec = pool[key];
		const { body } = decomposeText(rec.text);
		if (!body.trim()) out.push(`the message at offset ${key} is empty`);
		if ((rec.participants | 0) + 1 > 4) {
			out.push(`a message needs ${rec.participants + 1} players, but a party is four`);
		}
	}
	return out;
}
