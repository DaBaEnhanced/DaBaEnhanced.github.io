// Smoke test for follow-the-leader (Controls&Movement.s:4146).

import { ACTION, WINDOW } from '../src/gadgets.js';
import { cellIndex } from '../src/view.js';
import {
	AUTOMOVE_TICKS, PATH_SIZE, actionToward, createPath, createTeamState,
	followLeader, isLeader, latestPathIndex, layPath, movePlayer, setLeader, setTeam,
	clearLeaderIf,
} from '../src/team.js';

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function player(index, x, y, floor = 2, direction = 0) {
	return {
		index, x, y, floor, direction,
		inTeam: true, autoMove: false, active: true, dead: false, inExit: false,
		windowType: WINDOW.VIEW, path: createPath(),
	};
}

{
	const p = player(0, 5, 5);
	for (let i = 0; i < 3; i++) {
		p.y -= 1;
		layPath(p);
	}
	assert(p.path.length === PATH_SIZE, 'path length changed');
	assert(p.path[PATH_SIZE - 1] === cellIndex(5, 2, 2), 'newest cell not appended');
	assert(p.path[PATH_SIZE - 2] === cellIndex(5, 3, 2), 'shift dropped the wrong end');
	assert(latestPathIndex(p.path, cellIndex(5, 2, 2)) === PATH_SIZE - 1, 'latest index');
	const before = p.path[PATH_SIZE - 1];
	layPath(p);
	assert(p.path[PATH_SIZE - 1] === before, 'stationary lay_path must not shift');
}

{
	assert(actionToward(0, 0) === ACTION.FORWARD, 'already facing');
	assert(actionToward(1, 0) === ACTION.TURN_LEFT, 'east to north');
	assert(actionToward(3, 0) === ACTION.TURN_RIGHT, 'west to north');
	assert(actionToward(2, 0) === ACTION.TURN_LEFT, 'south to north');
	assert(actionToward(0, 1) === ACTION.TURN_RIGHT, 'north to east');
}

{
	const state = createTeamState(4);
	const leader = player(0, 10, 10);
	const follower = player(1, 10, 11);
	layPath(leader);
	assert(setLeader(state, leader), 'first walk claims leader1');
	assert(state.leader1 === 1, 'leader id is 1-based');
	assert(isLeader(state, leader) && !isLeader(state, follower), 'leader test');
	leader.y = 9;
	layPath(leader);
	const action = movePlayer(state, leader, follower);
	assert(action === ACTION.FORWARD, `adjacent follower should walk, got ${action}`);
	assert(follower.autoMove, 'move_player sets auto_move');
}

{
	const state = createTeamState(4);
	const leader = player(0, 10, 10);
	const follower = player(1, 10, 11, 2, 2);
	layPath(leader);
	setLeader(state, leader);
	leader.y = 9;
	layPath(leader);
	assert(movePlayer(state, leader, follower) === ACTION.TURN_LEFT,
		'facing south, want north: turn left');
}

{
	const state = createTeamState(4);
	const leader = player(0, 10, 10);
	const follower = player(1, 10, 11);
	setLeader(state, leader);
	assert(movePlayer(state, leader, leader) === null, 'leader does not follow');
	follower.inTeam = false;
	assert(movePlayer(state, leader, follower) === null, 'solo does not follow');
	follower.inTeam = true;
	follower.dead = true;
	assert(movePlayer(state, leader, follower) === null, 'dead does not follow');
	follower.dead = false;
	follower.windowType = WINDOW.STORE;
	assert(movePlayer(state, leader, follower) === null, 'non-view does not step');
	assert(follower.autoMove, 'non-view still marks auto_move');
}

{
	const state = createTeamState(4);
	const players = [player(0, 10, 10), player(1, 10, 11), player(2, 8, 8), player(3, 7, 7)];
	layPath(players[0]);
	setLeader(state, players[0]);
	players[0].y = 9;
	layPath(players[0]);
	assert(followLeader(state, players, AUTOMOVE_TICKS).length === 0, 'count==10 does not fire');
	const fired = followLeader(state, players, 1);
	assert(fired.length === 1 && fired[0].player === players[1], 'only the adjacent teammate moves');
	assert(fired[0].action === ACTION.FORWARD, 'follow step is forward');
}

{
	const state = createTeamState(4);
	const leader = player(0, 4, 4);
	setLeader(state, leader);
	assert(setTeam(state, leader) === false, 'toggle leaves team');
	assert(state.leader1 === 0, 'set_team clears leader1');
	assert(!leader.inTeam, 'now solo');
	leader.inTeam = true;
	setLeader(state, leader);
	clearLeaderIf(state, leader);
	assert(state.leader1 === 0, 'death clears leader');
}

{
	const state = createTeamState(2);
	const p1 = player(0, 1, 1);
	const p2 = player(1, 2, 2);
	setLeader(state, p1);
	setLeader(state, p2);
	assert(state.leader1 === 1 && state.leader2 === 2, '2-player split leaders');
	setTeam(state, p2);
	assert(state.leader2 === 0 && state.leader1 === 1, 'pair-2 toggle only clears leader2');
}

console.log('team smoke: path FIFO, on_path facing, follow gate, set_team/leader checked');
