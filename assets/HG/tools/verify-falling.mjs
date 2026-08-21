// Smoke tests for player falling and the source-order stuff_falls scheduler.

import { createFallClock, createFallState, playersFall, stuffFalls } from '../src/falling.js';
import { putHeadInMap } from '../src/movement.js';
import { LEVEL_CELLS, cellIndex } from '../src/view.js';

const FLOOR_HERE = 1;
const BLOCK_HERE = 2;
const WATER_HERE = 4;
const AUX_HERE = 1 << 5;
const SHIFT = { water: 17, aux: 28 };

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function makeCells() {
	return new Uint32Array(LEVEL_CELLS * 12);
}

function makePlayer(floor = 3) {
	return {
		x: 5,
		y: 5,
		floor,
		index: 0,
		direction: 0,
		active: true,
		fall: createFallState(),
		stats: { weight: 80, agility: 100, physique: 100 },
	};
}

{
	const cells = makeCells();
	const player = makePlayer(3);
	const below = cellIndex(player.x, player.y, player.floor) - LEVEL_CELLS;
	cells[below] = AUX_HERE | (2 << SHIFT.aux);
	putHeadInMap(cells, player);
	assert(playersFall(cells, [player], {}), 'player did not fall into loose item cell');
	assert(player.floor === 2, `player floor after loose-item fall ${player.floor}`);
	assert(cells[below] & BLOCK_HERE, 'player was not stamped into loose item cell');
	assert(cells[below] & AUX_HERE, 'loose item AUX was lost while falling through');
}

{
	const cells = makeCells();
	const player = makePlayer(4);
	for (let f = 0; f <= 4; f++) {
		cells[cellIndex(player.x, player.y, f)] = WATER_HERE | (2 << SHIFT.water);
	}
	putHeadInMap(cells, player);
	assert(playersFall(cells, [player], {}), 'player did not enter flooded shaft');
	assert(player.floor === 3, `water fall first floor ${player.floor}`);
	playersFall(cells, [player], {});
	playersFall(cells, [player], {});
	assert(player.floor === 3, `water fall pause floor ${player.floor}`);
	assert(playersFall(cells, [player], {}), 'player did not sink on third water fall tick');
	assert(player.floor === 2, `water fall second floor ${player.floor}`);
}

{
	const order = [];
	const clock = createFallClock();
	const cells = makeCells();
	stuffFalls(clock, cells, [], {
		blocksFall: () => { order.push('blocks'); return false; },
		monstersFall: () => { order.push('monsters'); return false; },
		sentriesFall: () => { order.push('sentries'); return false; },
	}, 13);
	assert(order.join(',') === 'blocks,monsters,sentries',
		`stuff_falls hook order ${order.join(',')}`);
}

{
	const clock = createFallClock();
	const cells = makeCells();
	const player = makePlayer(1);
	cells[cellIndex(player.x, player.y, player.floor)] = FLOOR_HERE;
	putHeadInMap(cells, player);
	const changed = stuffFalls(clock, cells, [player], {
		blocksFall: () => false,
		monstersFall: () => true,
		sentriesFall: () => false,
	}, 13);
	assert(changed, 'monster/sentry fall hooks should contribute redraw');
}

console.log('fall smoke: player item/water falling and stuff_falls order checked');
