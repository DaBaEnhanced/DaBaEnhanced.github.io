// The cheat toggle: invulnerability, infinite carry, every item in the game.
//
// Modelled on Sources/Cheat.s, whose cheat_mode3 makes decr_fitness return
// before touching fitness, and cheat_mode2 bypasses gating checks.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createInventory, refreshInventory, stockInventory, INVENTORY_SIZE, hasItem,
} from '../src/inventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
const itemDefs = JSON.parse(fs.readFileSync(path.join(A, 'items.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

const defs = itemDefs.items || itemDefs;
const nums = defs
	.filter((d) => d && d.index > 0 && (d.header || []).some((h) => h && h.trim()))
	.map((d) => d.index);

ok(nums.length > 100, `found the real items (${nums.length})`);
ok(nums.length > INVENTORY_SIZE, 'more items than one inventory holds');
ok(nums.length <= INVENTORY_SIZE * 4, 'but the four-player party can hold them all');

// Deal them across four players the way applyCheatToParty does.
const players = [0, 1, 2, 3].map(() => ({
	inventory: createInventory(null),
	stats: { physique: 1, weight: 0 },   // physique 1: everything is too heavy
	noWeightLimit: false,
}));
const per = Math.ceil(nums.length / players.length);
players.forEach((p, i) => stockInventory(p.inventory, nums.slice(i * per, (i + 1) * per)));

const held = new Set();
for (const p of players) for (const it of p.inventory.store) if (hasItem(it)) held.add(it.num);
ok(held.size === nums.length, `party holds every item (${held.size}/${nums.length})`);
ok(nums.every((n) => held.has(n)), 'no item missing from the party');
ok([...players[0].inventory.store].every((it) => !hasItem(it) || it.ammo === 255),
	'stocked items carry full ammo');
ok([...players[0].inventory.store].every((it) => !hasItem(it) || it.damage === 0),
	'stocked items are undamaged');

// Infinite carry: same load, weight limit on vs off.
const heavy = players[0];
refreshInventory(heavy, itemDefs);
ok(heavy.tooHeavy === true, 'a full load is too heavy for physique 1 normally');
const loadedWeight = heavy.inventory.weight;
heavy.noWeightLimit = true;
refreshInventory(heavy, itemDefs);
ok(heavy.tooHeavy === false, 'noWeightLimit lifts the carry limit');
ok(heavy.inventory.weight === loadedWeight,
	'weight is still reported, just not enforced');

console.log(`cheat: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
