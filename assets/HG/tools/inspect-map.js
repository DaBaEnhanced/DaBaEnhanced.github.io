'use strict';
// Decode a .map file and report its contents, as a correctness check on the
// layout derived from Sources/Equates.i.
const fs = require('fs');
const M = require('./lib/hgmap');

const file = process.argv[2];
const map = M.parseMap(fs.readFileSync(file));
const { locn, header } = map;

console.log(`${file}`);
console.log(`\n-- locn (world map record)`);
console.log(`  legend      : ${locn.legend}`);
console.log(`  legend2     : ${locn.legend2.slice(0, 90)}`);
console.log(`  at ${locn.x},${locn.y}  players=${locn.players}  type=${locn.typeFlag}`);
console.log(`  map=${locn.mapNum} style=${locn.style} sky=${locn.sky} atmos=${locn.atmos}` +
	`  music=${locn.musicNum} pic=${locn.pictureNum}  monsters=${locn.mons1},${locn.mons2}`);
console.log(`  destinations: ${locn.destinations.join(', ') || '(none)'}`);

console.log(`\n-- map header  (ends at file offset ${header.headerEnd})`);
console.log(`  name        : ${header.nameText.slice(0, 90)}`);
console.log(`  starts      : ${header.starts.map((p) => `${p.x},${p.y}@${p.floor}`).join('  ')}`);
console.log(`  exit        : ${header.exit.x},${header.exit.y}@${header.exit.floor}`);
console.log(`  time limit  : ${header.timeLimit} units (${header.timeLimit * 10}s)`);
console.log(`  water       : level=${header.waterLevel} low=${header.lowWaterLevel} ` +
	`hi=${header.hiWaterLevel} speed=${header.waterSpeed}`);
console.log(`  monsters=${header.monsters.length} buttons=${header.buttons.length} ` +
	`lifts=${header.lifts.length} doors=${header.doors.length} ` +
	`pushables=${header.pushables.length} triggers=${header.textTriggers.length}`);
for (const t of header.textMessages) if (t) console.log(`  message     : ${t.slice(0, 80)}`);

// Cell census per floor: a good smoke test that the packed format is right.
console.log(`\n-- cell census by floor`);
let totalSolid = 0;
for (let f = 0; f < M.MAP_HEIGHT; f++) {
	const counts = { floor: 0, block: 0, water: 0, aux: 0, panel: 0 };
	const blockKinds = new Map();
	for (let y = 0; y < M.MAP_DEPTH; y++) {
		for (let x = 0; x < M.MAP_WIDTH; x++) {
			const c = M.decodeCell(map.cells[M.cellIndex(x, y, f)]);
			if (c.floorHere) counts.floor++;
			if (c.waterHere) counts.water++;
			if (c.auxHere) counts.aux++;
			if (c.panelHere) counts.panel++;
			if (c.blockHere) {
				counts.block++;
				const k = M.BLOCK_TYPES[c.blockType] || `#${c.blockType}`;
				blockKinds.set(k, (blockKinds.get(k) || 0) + 1);
			}
		}
	}
	totalSolid += counts.block;
	if (!counts.floor && !counts.block && !counts.water) continue;
	const kinds = [...blockKinds.entries()].sort((a, b) => b[1] - a[1])
		.map(([k, v]) => `${k}:${v}`).join(' ');
	console.log(`  floor ${String(f).padStart(2)}  floor=${String(counts.floor).padStart(3)} ` +
		`block=${String(counts.block).padStart(3)} water=${String(counts.water).padStart(3)} ` +
		`aux=${String(counts.aux).padStart(2)} panel=${String(counts.panel).padStart(2)}  ${kinds}`);
}
console.log(`  total blocks: ${totalSolid}`);

// Items lying on the ground (part 3).
const itemCounts = new Map();
for (let i = 0; i < map.items.length; i++) {
	const t = map.items[i] & 0xff;
	if (t) itemCounts.set(t, (itemCounts.get(t) || 0) + 1);
}
console.log(`\n-- ground items: ${[...itemCounts.values()].reduce((a, b) => a + b, 0)} across ` +
	`${itemCounts.size} types  [${[...itemCounts.entries()].sort((a, b) => a[0] - b[0])
		.map(([t, n]) => `${t}x${n}`).join(' ')}]`);
