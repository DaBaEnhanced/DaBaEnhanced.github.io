// Smoke test for task #21 inventory/death/drop edge cases.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEVEL_CELLS, cellIndex } from '../src/view.js';
import { createDoorState, triggerDoor, DOOR } from '../src/doors.js';
import {
	createInventory, pickUpIntoInventory, pickUpToHand, dropHeldItem, hasItem, hasLooseItem,
	peekLooseItem, carryingItem, removeCarriedItem, heldReloadState, reloadHeldItem,
} from '../src/inventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');
const itemsData = JSON.parse(fs.readFileSync(path.join(ASSETS, 'items.json'), 'utf8'));
const abandonedDepot = JSON.parse(fs.readFileSync(path.join(ASSETS, 'maps', '07-AbandonedDepot.json'), 'utf8'));

const FLOOR_HERE = 1;
const AUX_HERE = 1 << 5;
const AUX_SKELETON = 7;
const AUX_DATA_SHIFT = 12;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

{
	const player = { inventory: createInventory(null), stats: { weight: 0, physique: 100 } };
	player.inventory.using = { num: 15, damage: 0, ammo: 2, outlined: 0 };
	player.inventory.store[0] = { num: 45, damage: 0, ammo: 20, outlined: 0 };
	assert(heldReloadState(player, itemsData).ready, 'part-loaded gun with a clip not reloadable');
	const result = reloadHeldItem(player, itemsData);
	assert(result.changed && player.inventory.using.ammo === 16, 'reload did not fill held gun');
	assert(player.inventory.store[0].num === 45 && player.inventory.store[0].ammo === 6,
		'reload did not leave the partial clip in inventory');
	assert(heldReloadState(player, itemsData).reason === 'full', 'full gun still exposes reload');
}

{
	const cells = new Uint32Array(LEVEL_CELLS * 2);
	const seen = new Uint32Array(cells.length);
	const items = new Uint32Array(cells.length);
	for (let i = 0; i < cells.length; i++) cells[i] = FLOOR_HERE;

	const dead = { inventory: createInventory(null), stats: { weight: 0, physique: 100 } };
	dead.inventory.using = { num: 15, damage: 2, ammo: 3, outlined: 0 };
	dead.inventory.store[0] = { num: 64, damage: 0, ammo: 1, outlined: 0 };
	const picker = { inventory: createInventory(null), stats: { weight: 0, physique: 100 } };
	const players = [dead, picker];
	const cell = cellIndex(5, 5, 1);
	cells[cell] = FLOOR_HERE | AUX_HERE | (AUX_SKELETON << 28);
	seen[cell] = 0 << AUX_DATA_SHIFT;

	const first = pickUpToHand(picker, cells, items, itemsData, cell, seen, players);
	assert(first.changed && first.item.num === 15, 'skeleton hand item not picked first');
	assert(!hasItem(dead.inventory.using), 'dead player hand item not removed');

	const second = pickUpToHand(picker, cells, items, itemsData, cell, seen, players);
	assert(second.changed && second.item.num === 64, 'skeleton store item not picked second');
	assert(!hasItem(dead.inventory.store[0]), 'dead player store item not removed');

	picker.inventory.using = { num: 15, damage: 0, ammo: 1, outlined: 0 };
	const drop = dropHeldItem(picker, cells, items, itemsData, cell, seen, players);
	assert(drop.changed && hasItem(dead.inventory.store[0]), 'drop onto skeleton not stored');
}

{
	const cells = new Uint32Array(LEVEL_CELLS * 2);
	const seen = new Uint32Array(cells.length);
	const items = new Uint32Array(cells.length);
	for (let i = 0; i < cells.length; i++) cells[i] = FLOOR_HERE;

	const picker = {
		inventory: createInventory(null),
		stats: { weight: 0, physique: 100 },
	};
	const eggLike = cellIndex(4, 4, 1);
	cells[eggLike] = FLOOR_HERE | AUX_HERE;       // AUX 0, not a container.
	items[eggLike] = 66;
	assert(!hasLooseItem(cells, items, eggLike), 'AUX 0 low item byte exposed as loose item');
	assert(!peekLooseItem(cells, items, eggLike, seen, [picker]), 'AUX 0 peek returned an item');
	const badPickup = pickUpToHand(picker, cells, items, itemsData, eggLike, seen, [picker]);
	assert(!badPickup.changed && badPickup.reason === 'empty', 'AUX 0 pickup should be empty');
	assert(cells[eggLike] & AUX_HERE, 'failed pickup cleared non-container AUX');

	const container = cellIndex(5, 4, 1);
	cells[container] = FLOOR_HERE | AUX_HERE | (2 << 28);
	items[container] = 66;
	const pickup = pickUpToHand(picker, cells, items, itemsData, container, seen, [picker]);
	assert(pickup.changed && pickup.item.num === 66, 'container item not picked up');
	assert(!(cells[container] & AUX_HERE), 'container AUX not cleared after pickup');
}

{
	const cells = new Uint32Array(LEVEL_CELLS * 2);
	const items = new Uint32Array(cells.length);
	for (let i = 0; i < cells.length; i++) cells[i] = FLOOR_HERE;

	const picker = {
		inventory: createInventory(null),
		stats: { weight: 0, physique: 100 },
	};
	const cell = cellIndex(6, 4, 1);
	cells[cell] = FLOOR_HERE | AUX_HERE | (2 << 28);
	items[cell] = 15 | (2 << 8) | (6 << 16);
	const pickup = pickUpIntoInventory(picker, cells, items, itemsData, cell);
	assert(pickup.changed, 'ground item not picked into inventory');
	assert(picker.inventory.store[0].num === 15, 'ground item inserted in wrong slot');
	assert(picker.inventory.store[0].outlined === 0, 'ground pickup kept white outline flag');
}

{
	const nuke1 = itemsData.items[28];
	const nuke2 = itemsData.items[66];
	assert(nuke1.category === 22 && nuke1.nuke?.number === 1, 'nuke unit 1 decode mismatch');
	assert(nuke2.category === 22 && nuke2.nuke?.number === 2, 'nuke unit 2 decode mismatch');
}

{
	const player = { inventory: createInventory(null), stats: { weight: 0, physique: 100 } };
	player.inventory.store[0] = { num: 71, damage: 0, ammo: 1, outlined: 0 };
	player.inventory.store[1] = { num: 15, damage: 0, ammo: 2, outlined: 0 };
	const doors = createDoorState([{
		posn: 40, direction: DOOR.LOCKED, type: 40962, delay: 18,
		key: 71, buttonOnly: 0,
	}]);
	const result = triggerDoor(doors, 10, { carrying: (num) => carryingItem(player.inventory, num) });
	assert(result.unlocked && result.key === 71, 'locked door did not recognise carried key');
	removeCarriedItem(player, itemsData, result.key);
	assert(!carryingItem(player.inventory, 71), 'used key was not removed');
	assert(player.inventory.store[0].num === 15, 'inventory did not compact after key removal');
}

{
	const keyedDoors = abandonedDepot.doors.filter((d) => d.direction === DOOR.LOCKED && d.key);
	assert(keyedDoors.length === 4, `Abandoned Depot keyed door count ${keyedDoors.length}`);
	const keySet = new Set(keyedDoors.map((d) => d.key));
	assert(keySet.has(71) && keySet.has(75) && keySet.has(76),
		`Abandoned Depot key set ${[...keySet].sort((a, b) => a - b)}`);
	for (const door of keyedDoors) {
		const player = { inventory: createInventory(null), stats: { weight: 0, physique: 100 } };
		player.inventory.using = { num: door.key, damage: 0, ammo: 1, outlined: 0 };
		player.inventory.store[0] = { num: 15, damage: 0, ammo: 2, outlined: 0 };
		const doors = createDoorState([door]);
		const result = triggerDoor(doors, door.posn >>> 2, {
			carrying: (num) => carryingItem(player.inventory, num),
		});
		assert(result.unlocked && result.key === door.key,
			`Abandoned Depot door ${door.index} rejected key ${door.key}`);
		removeCarriedItem(player, itemsData, result.key);
		assert(!hasItem(player.inventory.using), `Abandoned Depot key ${door.key} not consumed from hand`);
		assert(player.inventory.store[0].num === 15,
			`Abandoned Depot key ${door.key} removal disturbed inventory`);
	}
}

console.log('inventory task21 smoke: skeleton transfer, pickup outline, nuke item data and keyed Abandoned Depot doors checked');
