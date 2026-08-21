// Smoke test for task #21 combat/projectile/sentry runtime pieces.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEVEL_CELLS, cellIndex } from '../src/view.js';
import { BLOCK } from '../src/movement.js';
import {
	createCombatState, addFireball, moveFireballs, addGrenade,
	fireWeaponAtTarget, triggerMine, EXPL_DECAY,
} from '../src/combat.js';
import {
	createSentryState, addSentry, moveSentries, damageSentryAtCell,
} from '../src/sentries.js';
import { decodeILBM } from './lib/iff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

const FLOOR_HERE = 1, BLOCK_HERE = 2, AUX_HERE = 1 << 5, OPAQUE = 1 << 6;
const blockType = (cell) => (cell >>> 11) & 0x3f;
const variant = (cell) => (cell >>> 23) & 0x1f;
const explosionType = (cell) => (cell >>> 21) & 0x3;
const blockWord = (type, variant_ = 0) =>
	(BLOCK_HERE | (type << 11) | (variant_ << 23)) >>> 0;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function countSourcePixels(img, x0, y0, w, h) {
	let count = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (img.pixels[(y0 + y) * img.width + x0 + x]) count++;
		}
	}
	return count;
}

const items = JSON.parse(fs.readFileSync(path.join(ASSETS, 'items.json'), 'utf8'));
const exgfx = JSON.parse(fs.readFileSync(path.join(ASSETS, 'exgfx.json'), 'utf8'));
const explosions = JSON.parse(fs.readFileSync(path.join(ASSETS, 'explosions.json'), 'utf8'));
const explosionAtlas = new Uint8Array(fs.readFileSync(path.join(ASSETS, explosions.atlas.file)));
const fireEffects = JSON.parse(fs.readFileSync(path.join(ASSETS, 'fire-effects.json'), 'utf8'));
const fireEffectsAtlas = new Uint8Array(fs.readFileSync(path.join(ASSETS, fireEffects.atlas.file)));
const fireEffectsSource = decodeILBM(fs.readFileSync(
	path.resolve(__dirname, '..', '..', 'Data', 'GameChip.dat', 'FireEffectsCD32.ilbm')));
const miscUi = JSON.parse(fs.readFileSync(path.join(ASSETS, 'misc-ui.json'), 'utf8'));
const item = (num) => items.items[num - 1];

assert(item(1).gun?.fire?.front === 4, 'launcher gun tail not decoded');
assert(item(27).grenade?.north === 4 && item(27).grenade?.south === 4,
	'grenade arcs not decoded in source runtime order');
assert(item(112).mine?.damage === 125 && item(112).mine?.north === 2,
	'armed mine data not decoded');
for (let block = 22; block <= 27; block++) {
	const rec = exgfx.blocks.find((b) => b.block === block);
	assert(rec?.slots?.some(Boolean), `ExGfx block ${block} has no slots`);
}
assert(explosions.kind === 'indexedSprite', 'explosions are not CD32 indexed sprites');
assert(explosions.source?.includes('expl1.bin'), 'explosions are not built from CD32 expl*.bin');
assert(new Set(explosionAtlas.filter(Boolean)).size >= 3,
	'explosion atlas does not contain the CD32 colour levels');
assert(fireEffects.sprites?.muzzle_0 && fireEffects.sprites?.zap_4 &&
	fireEffects.sprites?.electric_4, 'fire-effect animation rows missing');
assert(fireEffects.sprites?.hit_3_8 && fireEffects.palettes?.muzzleBases?.length === 4,
	'fire-effect hit sprites or per-pane muzzle palettes missing');
assert(fireEffects.sprites?.fitness_0 && fireEffects.sprites?.fitness_1,
	'fitness flash hardware-sprite frames missing');
assert(fireEffects.sprites.fitness_0.w === 32 && fireEffects.sprites.fitness_1.w === 32,
	'fitness flash CD32 attached sprite records should stay 32 pixels wide');
assert(countSourcePixels(fireEffectsSource, 0, 224, 32, 17) === 144,
	'fitness flash left source crop changed');
assert(countSourcePixels(fireEffectsSource, 16, 224, 32, 17) === 150,
	'fitness flash right attached source crop changed');
assert(countSourcePixels(fireEffectsSource, 48, 224, 16, 17) === 0,
	'fitness flash right crop includes unrelated art beyond its attached sprite half');
assert(fireEffectsAtlas.some((v) => v === 4), 'fire-effect atlas missing colour 3 data');
assert(miscUi.sprites?.claws?.mode === 'planeOp' &&
	miscUi.sprites?.bigclaws?.mode === 'planeOp',
	'monster claw screen-effect BOBs missing');

const cells = new Uint32Array(LEVEL_CELLS * 2);
const seen = new Uint32Array(cells.length);
const mapItems = new Uint32Array(cells.length);
for (let i = 0; i < cells.length; i++) cells[i] = FLOOR_HERE;
const hooks = {
	itemMeta: item,
	hitCell: (_cell, hit) => hit,
	activeMonsters: () => [],
	stunMonster: () => {},
};

{
	const state = createCombatState();
	const from = cellIndex(10, 10, 1);
	const north = from - 23;
	assert(addFireball(state, cells, seen, mapItems, from, {
		direction: 0, speed: 1, decay: EXPL_DECAY, density: 2, flameback: 0,
		style: 0, owner: 0,
	}, hooks), 'fireball was not allocated');
	assert((cells[north] & 16) && explosionType(cells[north]) === 2,
		'fireball did not stamp explosion in front cell');
	moveFireballs(state, cells, seen, mapItems, 11, { style: 0 }, hooks);
	assert(cells[north] & 16, 'speed-1 fireball should hold for one explosion tick');
	moveFireballs(state, cells, seen, mapItems, 11, { style: 0 }, hooks);
	assert(!(cells[north] & 16), 'fireball did not clear old explosion');
	assert(cells[north - 23] & 16, 'fireball did not advance');
}

{
	const state = createCombatState();
	const from = cellIndex(7, 7, 1);
	assert(addGrenade(state, cells, { index: 2 }, item(27), from, {
		direction: 1, xvel: 3, yvel: -1000, height: 25,
	}), 'grenade was not allocated');
	assert(blockType(cells[from]) === 22 && variant(cells[from]) === 25,
		'grenade did not stamp ExGfx block/height');
	moveFireballs(state, cells, seen, mapItems, 11, { style: 0 }, hooks);
	assert(!(cells[from] & BLOCK_HERE), 'grenade did not leave source cell');
	moveFireballs(state, cells, seen, mapItems, 11, { style: 0 }, hooks);
	moveFireballs(state, cells, seen, mapItems, 11, { style: 0 }, hooks);
	assert(blockType(cells[from + 3]) === 22,
		'grenade x velocity did not carry it three cells');
}

{
	const state = createCombatState();
	const mineCell = cellIndex(4, 4, 1);
	cells[mineCell] = FLOOR_HERE | AUX_HERE | (2 << 28);
	mapItems[mineCell] = 112;
	const damage = triggerMine(state, cells, seen, mapItems, mineCell, hooks);
	assert(damage === (125 << 11), `mine damage ${damage}`);
	assert(!(cells[mineCell] & AUX_HERE), 'mine aux was not cleared');
	assert(state.fireballs.filter((f) => f.pos).length === 6, 'mine did not spawn six fireballs');
}

{
	const cells2 = new Uint32Array(LEVEL_CELLS * 2);
	const seen2 = new Uint32Array(cells2.length);
	const items2 = new Uint32Array(cells2.length);
	for (let i = 0; i < cells2.length; i++) cells2[i] = FLOOR_HERE;
	const combat = createCombatState();
	const sentries = createSentryState();
	const pos = cellIndex(8, 8, 1);
	const target = pos + 2;
	cells2[target] = blockWord(BLOCK.MONSTER_FIRST);
	assert(addSentry(sentries, cells2, pos, 1, item(30), 1), 'sentry did not deploy');
	assert(blockType(cells2[pos]) === 25, 'sentry did not stamp east-facing block 25');
	for (let i = 0; i < 55; i++) {
		moveSentries(sentries, cells2, combat, seen2, items2, 11, {
			style: 0, combatHooks: hooks,
		});
	}
	assert(combat.fireballs.some((f) => f.pos), 'sentry did not fire at monster');
	assert(damageSentryAtCell(sentries, cells2, pos, 999999), 'sentry was not destroyed by damage');
	assert(!(cells2[pos] & BLOCK_HERE), 'destroyed sentry block was not cleared');
}

{
	const cells3 = new Uint32Array(LEVEL_CELLS * 2);
	const seen3 = new Uint32Array(cells3.length);
	const items3 = new Uint32Array(cells3.length);
	for (let i = 0; i < cells3.length; i++) cells3[i] = FLOOR_HERE;
	const from = cellIndex(2, 2, 1);
	const target = from + 1;
	cells3[target] = blockWord(BLOCK.MONSTER_FIRST);
	const hits = [];
	const player = { index: 0, direction: 1, stats: { experience: 0 } };
	fireWeaponAtTarget(cells3, seen3, items3, from, player, item(15), 0, {
		hatchEggAt: () => false,
		hitCell: (cell, hit) => { hits.push({ cell, hit }); return { monsterKilled: false }; },
	});
	assert(hits.length === 1 && hits[0].cell === target, 'weapon did not hit first monster block');
	assert(hits[0].hit.monsterDamage === 40 * 1 * 512, 'weapon damage scale mismatch');
}

console.log('combat smoke: fireballs, grenades, mines, sentries, weapons and ExGfx checked');
