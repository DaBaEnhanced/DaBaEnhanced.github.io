// Follow-the-leader: port of follow_leader / move_player / on_path / lay_path /
// set_leader / set_team (Controls&Movement.s:4146).
//
// Each player keeps a 20-cell FIFO of recent map positions. On the 50 Hz
// automove gate, every in-team non-leader looks at the leader's trail and
// queues a turn or a forward step toward the newest neighbouring cell on it.
// `move(..., auto=true)` already refuses ledges and bump reactions.

import { MAP_WIDTH, LEVEL_CELLS, cellIndex } from './view.js';
import { ACTION, WINDOW } from './gadgets.js';

export const PATH_SIZE = 20;
export const AUTOMOVE_TICKS = 10;

const EMPTY = -1;
const NEIGHBOURS = [
	{ dir: -1, dx: 0, dy: 0, df: 0 },
	{ dir: 0, dx: 0, dy: -1, df: 0 },
	{ dir: 2, dx: 0, dy: 1, df: 0 },
	{ dir: 3, dx: -1, dy: 0, df: 0 },
	{ dir: 1, dx: 1, dy: 0, df: 0 },
	{ dir: 0, dx: 0, dy: -1, df: 1 },
	{ dir: 2, dx: 0, dy: 1, df: 1 },
	{ dir: 3, dx: -1, dy: 0, df: 1 },
	{ dir: 1, dx: 1, dy: 0, df: 1 },
	{ dir: 0, dx: 0, dy: -1, df: -1 },
	{ dir: 2, dx: 0, dy: 1, df: -1 },
	{ dir: 3, dx: -1, dy: 0, df: -1 },
	{ dir: 1, dx: 1, dy: 0, df: -1 },
];

export function createPath() {
	return Array.from({ length: PATH_SIZE }, () => EMPTY);
}

export function createTeamState(numPlayers = 4) {
	return { leader1: 0, leader2: 0, count: 0, numPlayers: numPlayers | 0 || 4 };
}

export function layPath(player) {
	if (!player) return;
	if (!player.path || player.path.length !== PATH_SIZE) player.path = createPath();
	const here = cellIndex(player.x, player.y, player.floor);
	if (player.path[PATH_SIZE - 1] === here) return;
	player.path.shift();
	player.path.push(here);
}

export function latestPathIndex(path, cell) {
	if (!path || cell < 0) return EMPTY;
	for (let i = path.length - 1; i >= 0; i--) {
		if (path[i] === cell) return i;
	}
	return EMPTY;
}

export function isLeader(state, player) {
	if (!state || !player) return false;
	const n = (player.index | 0) + 1;
	return state.leader1 === n || state.leader2 === n;
}

export function clearLeaderIf(state, player) {
	if (!state || !player) return;
	const n = (player.index | 0) + 1;
	if (state.leader1 === n) state.leader1 = 0;
	if (state.leader2 === n) state.leader2 = 0;
}

// set_leader. Stored ids are 1-based. Auto-followers and solo players skip.
export function setLeader(state, player) {
	if (!state || !player || player.autoMove || !player.inTeam) return false;
	const n = (player.index | 0) + 1;
	if (state.numPlayers === 2) {
		if (n === 1 || n === 3) {
			if (state.leader1 === n) return false;
			state.leader1 = n;
			return true;
		}
		if (n === 2 || n === 4) {
			if (state.leader2 === n) return false;
			state.leader2 = n;
			return true;
		}
		return false;
	}
	if (state.leader1 === n) return false;
	state.leader1 = n;
	return true;
}

// set_team: drop this pair's leader, then flip in_team.
export function setTeam(state, player) {
	if (!state || !player) return player?.inTeam;
	const n = (player.index | 0) + 1;
	if (state.numPlayers === 2) {
		if (n === 1 || n === 3) state.leader1 = 0;
		else if (n === 2 || n === 4) state.leader2 = 0;
	} else {
		state.leader1 = 0;
	}
	player.inTeam = !player.inTeam;
	return player.inTeam;
}

// try_north/east/south/west: face the wanted compass dir, else turn toward it.
export function actionToward(facing, want) {
	const face = facing & 3;
	const dir = want & 3;
	if (face === dir) return ACTION.FORWARD;
	if (face === ((dir + 3) & 3)) return ACTION.TURN_RIGHT;
	return ACTION.TURN_LEFT;
}

export function movePlayer(state, leader, follower) {
	if (!state || !leader || !follower) return null;
	if (follower.dead || follower.inExit || follower.windowType === WINDOW.EXIT) return null;
	if (!follower.inTeam) return null;
	if (follower.active === false) return null;
	if (isLeader(state, follower)) return null;
	if ((follower.windowType ?? WINDOW.VIEW) !== WINDOW.VIEW) {
		follower.autoMove = true;
		return null;
	}
	if (follower.controlAction) return null;
	follower.autoMove = true;

	let best = EMPTY;
	let want = EMPTY;
	for (const n of NEIGHBOURS) {
		const cell = cellIndex(follower.x + n.dx, follower.y + n.dy, follower.floor + n.df);
		const idx = latestPathIndex(leader.path, cell);
		if (idx < 0) continue;
		if (idx >= best) {
			best = idx;
			want = n.dir;
		}
	}
	if (want < 0) return null;
	return actionToward(follower.direction, want);
}

function leaderPlayer(players, id) {
	if (!id) return null;
	return players[(id | 0) - 1] || null;
}

function collect(state, leader, players, indices, out) {
	if (!leader) return;
	for (const i of indices) {
		const follower = players[i];
		const action = movePlayer(state, leader, follower);
		if (action) out.push({ player: follower, action });
	}
}

// follow_leader. One step when the vblank counter crosses 10, no catch-up loop.
export function followLeader(state, players, ticks = 0) {
	if (!state || !players) return [];
	for (const p of players) if (p) p.autoMove = false;
	state.count = (state.count | 0) + (ticks | 0);
	if (state.count <= AUTOMOVE_TICKS) return [];
	state.count -= AUTOMOVE_TICKS;

	const out = [];
	if (state.numPlayers === 2) {
		collect(state, leaderPlayer(players, state.leader1), players, [0, 2], out);
		collect(state, leaderPlayer(players, state.leader2), players, [1, 3], out);
		return out;
	}
	collect(state, leaderPlayer(players, state.leader1), players, [0, 1, 2, 3], out);
	return out;
}
