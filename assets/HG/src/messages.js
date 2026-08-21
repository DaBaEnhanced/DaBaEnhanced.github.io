// In-world text triggers -- Main.s:555.
//
// Each map carries up to 50 triggers, each a cell plus a byte offset into a 3KB
// message pool. Every frame the game compares all four player positions against
// every live trigger; on a match it decides whether that player may see the
// message, fires it once, and pushes it onto the HUD scroller.
//
// Two gates decide whether a message actually shows:
//
//   Speaker   text[4] is '1'-'4' when only that player triggers the line.
//             Anything above '4' means any player does. '6' additionally gets
//             rewritten to the triggering player's digit, so the line reads as
//             spoken by whoever walked in.
//
//   Party     count_participants (Miscroutines.s:4183) counts the byte-27
//             speaker markers, and push_msg drops the message unless
//             participants + 1 <= players_alive. That is what stops a
//             three-hander playing to a party that is down to two.

import { cellIndex } from './view.js';

// Byte 27, written as an escape -- a literal control character in the source
// would be invisible and would not survive an editor round trip.
export const SPEAKER_MARK = String.fromCharCode(27);

// scroll_scrolly (ColdStartup.s:3096) shifts the whole 384x9 buffer left by one
// pixel per vblank -- an add.l/addx.l carry chain across the bitmap -- and stops
// once every longword group is empty. So a message lasts exactly as long as it
// takes to cross the band, not for a fixed time.
export const SCROLL_PX_PER_TICK = 1;

export function createMessageState(map) {
	return {
		// `fired` mirrors the original writing -1 into trigger_posn: one shot each.
		triggers: (map?.textTriggers || []).map((t) => ({
			cell: t.cell ?? (t.posn >>> 2),
			offset: t.offset | 0,
			fired: false,
		})),
		pool: map?.textMessages || {},
		active: null,
		// push_msg keeps a scroll_head/scroll_tail list, so messages queue
		// rather than overwrite each other.
		queue: [],
		scrollX: 0,
		width: 0,
	};
}

/**
 * Queue a message. push_msg walks the list and aborts if the same message is
 * already on it (Miscroutines.s:4165 `.find_same`), so a player standing on a
 * trigger cannot stack the same line repeatedly.
 */
export function pushMessage(state, text, player = 0) {
	if (!state || !text) return false;
	if (state.active?.text === text) return false;
	if (state.queue.some((m) => m.text === text)) return false;
	state.queue.push({ text, player });
	return true;
}

/**
 * Would `record` show for the player in slot `index` (0-based)?
 * @returns the text to display, or null.
 */
export function messageFor(record, index, playersAlive) {
	if (!record) return null;
	const digit = String(index + 1);
	const gate = record.speaker || '';
	// `cmp.b #"4" / bgt .ok` -- above '4' is open to anyone.
	const open = gate > '4';
	if (!open && gate !== digit) return null;
	// push_msg: participants + 1 must fit inside the surviving party.
	if ((record.participants | 0) + 1 > (playersAlive | 0)) return null;
	// '6' is rewritten to the triggering player, so the line names its speaker.
	return gate === '6'
		? record.text.slice(0, 4) + digit + record.text.slice(5)
		: record.text;
}

/**
 * One pass of the trigger check.
 *
 * @param players  the party, in slot order
 * @param hooks    { onMessage(text, playerIndex) }
 * @returns true when something fired
 */
export function checkTextTriggers(state, players, hooks = {}) {
	if (!state?.triggers.length || !players?.length) return false;
	const alive = players.filter((p) => p && !p.dead && p.active !== false).length;
	let fired = false;
	for (const t of state.triggers) {
		if (t.fired) continue;
		const record = state.pool[t.offset];
		if (!record) continue;
		for (let i = 0; i < players.length; i++) {
			const p = players[i];
			if (!p || p.dead || p.active === false) continue;
			if (cellIndex(p.x, p.y, p.floor) !== t.cell) continue;
			const text = messageFor(record, i, alive);
			if (!text) continue;              // wrong player, or too few left
			t.fired = true;
			pushMessage(state, text, i);
			hooks.onMessage?.(text, i);
			fired = true;
			break;
		}
	}
	return fired;
}

/**
 * Advance the scroll. Text enters at the right edge and slides left; when it has
 * fully left the band the message is finished and the next one starts.
 *
 * @param measure  (text) => pixel width, so this stays font-agnostic
 * @param bandWidth the visible width of the band
 * @returns true when anything moved, i.e. a redraw is due
 */
export function stepMessages(state, ticks = 1, measure = null, bandWidth = 320) {
	if (!state) return false;
	if (!state.active) {
		if (!state.queue.length) return false;
		state.active = state.queue.shift();
		state.scrollX = bandWidth;
		state.width = measure ? measure(state.active.text) : bandWidth;
		return true;
	}
	state.scrollX -= SCROLL_PX_PER_TICK * (ticks | 0);
	if (state.scrollX + state.width > 0) return true;   // still crossing
	state.active = null;
	state.scrollX = 0;
	state.width = 0;
	return true;
}

/**
 * Resolve the scroller's escape codes into readable text (ColdStartup.s:3388).
 *
 * A byte 27 introduces a name substitution, and the byte after it says whose:
 *
 *   '1'-'4'   that player's name
 *   'p' + N   the same, with the digit in the following byte
 *   '5'       a random living player
 *
 * Both scroll_pl and scrolld_pl point at the same player_name (Main.s:4848),
 * so 'p' and the bare digit resolve identically. Leaving the marker in and
 * stripping it -- which is what this used to do -- renders a bare digit where
 * the speaker's name belongs.
 */
export function renderMessage(text, names = [], pickRandom = null) {
	if (!text) return '';
	const nameOf = (slot) => names[slot] || `Player ${slot + 1}`;
	let out = '';
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== SPEAKER_MARK) { out += text[i]; continue; }
		const code = text[++i];
		if (code === undefined) break;
		let slot;
		if (code === 'p') slot = (text.charCodeAt(++i) || 49) - 49;
		else if (code === '5') slot = pickRandom ? pickRandom() : 0;
		else slot = code.charCodeAt(0) - 49;
		out += nameOf(Math.max(0, Math.min(names.length - 1 || 3, slot)));
	}
	return out.trim();
}

/** The line to draw, with speaker names substituted in. */
export function activeMessageText(state, names = [], pickRandom = null) {
	return renderMessage(state?.active?.text, names, pickRandom);
}

// ---------------------------------------------------------------------------
// Random chatter -- push_mesg_rand (Miscroutines.s:4096).
//
// Messages.dat is banked, and the bank number says what happened:
//
//   0-3            two players swapped places (Controls&Movement.s:4510)
//   4              idle, on a timer (ColdStartup.s:741)
//   5 + p*4 + band a player's fitness crossed a threshold (Main.s:1652)
//   20 + p         a player took over as leader (Controls&Movement.s:5778)
//
// The original stirs vhposr -- the raster beam position -- into its RNG, which
// is just a cheap entropy source; Math.random serves the same purpose.

/** mesg_timer counts 50Hz vblanks and fires at 2500, so once every 50 seconds. */
export const IDLE_CHATTER_TICKS = 2500;

export const BANK_IDLE = 4;
export const BANK_SWAP = 0;              // + player
export const BANK_FITNESS = 5;           // + player * 4 + band
export const BANK_LEADER = 20;           // + player

export function createChatterState(messagesData) {
	return { banks: messagesData?.banks || [], timer: 0 };
}

/**
 * Restore a bank record's leading substitution marker.
 *
 * build-gamedata strips control codes out of `text` and lists them in
 * `colours`, so a bank line arrives as `5 "I never wanted to be a mercenary."`
 * -- the 27 that tells the scroller the '5' is a name, not a character to
 * print, is gone. Put it back so these render through the same path as the
 * map's own trigger messages.
 */
function bankText(record) {
	const text = record?.text || '';
	if (!text) return '';
	return (record.colours || []).includes(27) ? SPEAKER_MARK + text : text;
}

/** A random line from `bank`, or '' when the bank is missing or empty. */
export function randomFromBank(state, bank) {
	const list = state?.banks?.[bank | 0]?.messages;
	if (!list || !list.length) return '';
	return bankText(list[(Math.random() * list.length) | 0]);
}

/**
 * Advance the idle-chatter timer. ColdStartup.s only speaks when more than one
 * player is alive -- a lone survivor has nobody to talk to.
 *
 * @returns the line to say, or '' if it is not time yet.
 */
export function stepChatter(state, playersAlive, ticks = 1) {
	if (!state) return '';
	state.timer += ticks | 0;
	if (state.timer < IDLE_CHATTER_TICKS) return '';
	state.timer = 0;
	if ((playersAlive | 0) <= 1) return '';
	return randomFromBank(state, BANK_IDLE);
}

/** Fitness band 0-3, from Main.s:1652 -- fitness / 6000, capped. */
export function fitnessBand(fitness) {
	return Math.floor((fitness | 0) / 6000);
}
