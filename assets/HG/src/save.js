// localStorage snapshots: campaign progress plus a mid-level game dump.

export const SAVE_SLOTS = ['quick', '1', '2', '3'];
const PREFIX = 'hiredguns-save-';

const PLAYER_KEEP = [
	'index', 'x', 'y', 'floor', 'direction', 'active', 'dead', 'inExit', 'inTeam',
	'windowType', 'path', 'hasAux', 'infoScroll', 'usingGrenade', 'throwGrenadeMode',
	'spellShield', 'spellImmune', 'spellWater', 'spellWings', 'spellWeights',
	'poisoned', 'poisonedStrength', 'poisonedCount', 'poisonedCountStore',
	'poisonedTotal', 'underwaterCount', 'drowningCount', 'tooHeavy',
	'autoMove', 'stats', 'inventory',
];

function slotKey(slot) {
	return PREFIX + (slot || 'quick');
}

function packU32(arr) {
	if (!arr) return null;
	return Array.from(arr, (v) => v >>> 0);
}

function unpackU32(src, dest) {
	if (!src || !dest) return;
	const n = Math.min(src.length, dest.length);
	for (let i = 0; i < n; i++) dest[i] = src[i] >>> 0;
}

function cloneJson(v) {
	try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; }
}

export function snapshotCampaign(shell) {
	if (!shell) return null;
	return {
		party: (shell.party || []).slice(),
		completed: (shell.completed || []).slice(),
		unlocked: (shell.unlocked || []).slice(),
		here: shell.here | 0,
		lastKey: shell.lastKey || '',
		actionFlag: shell.actionFlag | 0,
		trainingFlag: shell.trainingFlag | 0,
	};
}

export function applyCampaign(shell, data) {
	if (!shell || !data) return;
	if (Array.isArray(data.party)) shell.party = data.party.slice();
	if (Array.isArray(data.completed)) shell.completed = data.completed.slice();
	if (Array.isArray(data.unlocked)) shell.unlocked = data.unlocked.slice();
	if (data.here) shell.here = data.here | 0;
	if (data.lastKey) shell.lastKey = data.lastKey;
	shell.actionFlag = data.actionFlag | 0;
	shell.trainingFlag = data.trainingFlag | 0;
}

function packPlayer(p) {
	if (!p) return null;
	const out = {};
	for (const k of PLAYER_KEEP) out[k] = cloneJson(p[k]);
	out.characterId = p.character?.character ?? p.index;
	return out;
}

export function snapshotGame(game) {
	if (!game?.map) {
		return {
			version: 1,
			savedAt: new Date().toISOString(),
			kind: 'campaign',
			label: 'Campaign',
			shell: snapshotCampaign(game.shell),
			// Saved between maps there are no live players to pack, so the
			// party's carried kit only survives if it is stored explicitly.
			partyCarry: cloneJson(game.partyCarry) || null,
		};
	}
	return {
		version: 1,
		savedAt: new Date().toISOString(),
		kind: 'game',
		label: game.map.key,
		mapKey: game.map.key,
		active: game.active | 0,
		actionFlag: game.actionFlag | 0,
		atTrip1: game.atTrip1 | 0,
		atTrip2: game.atTrip2 | 0,
		mission: cloneJson(game.mission),
		cells: packU32(game.cells),
		seen: packU32(game.seen),
		items: packU32(game.items),
		players: (game.players || []).map(packPlayer),
		party: (game.shell?.party || []).slice(),
		doors: cloneJson(game.doors),
		lifts: cloneJson(game.lifts),
		buttons: cloneJson(game.buttons),
		pushables: cloneJson(game.pushables),
		water: cloneJson(game.water),
		team: cloneJson(game.team && { leader1: game.team.leader1, leader2: game.team.leader2 }),
		shell: snapshotCampaign(game.shell),
		partyCarry: cloneJson(game.partyCarry) || null,
	};
}

export function applyGameSnapshot(game, data) {
	if (!game || !data || data.kind !== 'game') return;
	unpackU32(data.cells, game.cells);
	unpackU32(data.seen, game.seen);
	unpackU32(data.items, game.items);
	game.active = data.active | 0;
	game.actionFlag = data.actionFlag | 0;
	game.atTrip1 = data.atTrip1 | 0;
	game.atTrip2 = data.atTrip2 | 0;
	game.partyCarry = cloneJson(data.partyCarry) || null;
	if (data.mission) game.mission = data.mission;
	if (data.doors && game.doors) Object.assign(game.doors, data.doors);
	if (data.lifts && game.lifts) Object.assign(game.lifts, data.lifts);
	if (data.buttons && game.buttons) Object.assign(game.buttons, data.buttons);
	if (data.pushables && game.pushables) Object.assign(game.pushables, data.pushables);
	if (data.water && game.water) Object.assign(game.water, data.water);
	if (data.team && game.team) {
		game.team.leader1 = data.team.leader1 | 0;
		game.team.leader2 = data.team.leader2 | 0;
	}
	if (Array.isArray(data.players) && Array.isArray(game.players)) {
		for (let i = 0; i < game.players.length && i < data.players.length; i++) {
			const src = data.players[i];
			const dst = game.players[i];
			if (!src || !dst) continue;
			for (const k of PLAYER_KEEP) {
				if (src[k] !== undefined) dst[k] = cloneJson(src[k]);
			}
		}
	}
}

export function writeSlot(slot, data) {
	localStorage.setItem(slotKey(slot), JSON.stringify(data));
}

export function readSlot(slot) {
	try {
		const raw = localStorage.getItem(slotKey(slot));
		return raw ? JSON.parse(raw) : null;
	} catch (_) {
		return null;
	}
}

export function listSlots() {
	return SAVE_SLOTS.map((id) => {
		const data = readSlot(id);
		return {
			id,
			empty: !data,
			label: data ? `${id === 'quick' ? 'QUICK' : 'SLOT ' + id}  ${data.label || data.kind}` : `${id === 'quick' ? 'QUICK' : 'SLOT ' + id}  --`,
			savedAt: data?.savedAt || '',
			data,
		};
	});
}

export function newestSave() {
	let best = null;
	for (const rec of listSlots()) {
		if (rec.empty) continue;
		if (!best || (rec.savedAt || '') > (best.savedAt || '')) best = rec;
	}
	return best;
}
