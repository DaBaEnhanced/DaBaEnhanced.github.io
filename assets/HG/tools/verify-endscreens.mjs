// The death screen and the outro.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const meta = JSON.parse(fs.readFileSync(path.join(A, 'endscreens.json'), 'utf8'));

// --- the stills --------------------------------------------------------------
eq(meta.images.death.width, 320, 'the death screen is game width');
eq(meta.images.death.height, 212, 'and game height');
eq(meta.images.death.planes, 5, 'five bitplanes');
ok(!meta.images.death.ham, 'and not HAM');
eq(meta.images.backdrop.width, 320, 'the outro backdrop is 320 wide');
eq(meta.images.backdrop.height, 256, 'and 256 tall');
// Mushroom is the one that needed a decoder written for it.
eq(meta.images.mushroom.planes, 6, 'the mushroom cloud is six planes');
ok(meta.images.mushroom.ham, 'and HAM6, which plain indexed decoding cannot read');

for (const [key, info] of Object.entries(meta.images)) {
	const p = path.join(A, info.file);
	ok(fs.existsSync(p), `${key} png was written`);
	const b = fs.readFileSync(p);
	eq(b.readUInt32BE(16), info.width, `${key} png width matches the metadata`);
	eq(b.readUInt32BE(20), info.height, `${key} png height matches`);
	// File size says nothing useful -- the backdrop is horizontal scanlines and
	// deflates to under a kilobyte. What matters is that there is image data.
	let o = 8, idat = 0;
	while (o < b.length - 8) {
		const len = b.readUInt32BE(o);
		if (b.toString('ascii', o + 4, o + 8) === 'IDAT') idat += len;
		o += 12 + len;
	}
	ok(idat > 200, `${key} png carries image data (${idat} bytes of IDAT)`);
}

// --- the epilogues -----------------------------------------------------------
{
	eq(meta.outro.length, 12, 'twelve characters have an epilogue');
	// Text.s's `start` table is an ordered list, and the runtime picks by index.
	eq(meta.outro[0].key, 'clavius', 'the first entry is Clavius');
	eq(meta.outro[2].key, 'cim', 'the third is CIM');
	eq(meta.outro[11].key, 'cim_lite', 'the twelfth is CIM-Lite');
	ok(meta.outro.every((p) => p.lines.length > 0), 'every character has lines');

	const total = meta.outro.reduce((n, p) => n + p.lines.length, 0);
	eq(total, 87, `87 lines of epilogue in total (${total})`);
	ok(meta.outro.every((p) => p.lines.every((l) => l.text.length > 0)), 'no empty lines');

	// Every line is positioned, and the y values step down the screen.
	for (const person of meta.outro) {
		const ys = person.lines.map((l) => l.y);
		ok(ys.every((y, i) => i === 0 || y > ys[i - 1]),
			`${person.key}'s lines run down the page`);
		ok(ys[ys.length - 1] < 256, `${person.key} stays on the backdrop`);
	}
}

// --- the text fits the screen it is drawn on ---------------------------------
{
	// The font choice is load-bearing: the front-end faces are 48x44 and 64x66
	// display cells and overflow, worldfont at 16x8 overflows too. Only the
	// 16x6 HUD font keeps the longest line inside a 320px backdrop.
	const font = JSON.parse(fs.readFileSync(path.join(A, 'gamefont.json'), 'utf8'));
	const advance = (ch) => {
		const i = ch.charCodeAt(0) - font.startChar;
		return (i >= 0 && i < font.count && font.widths?.[i]) || font.cellWidth;
	};
	let widest = 0, widestText = '';
	for (const person of meta.outro) {
		for (const line of person.lines) {
			let w = 0;
			for (const ch of line.text) w += advance(ch);
			if (w > widest) { widest = w; widestText = line.text; }
		}
	}
	ok(widest <= meta.images.backdrop.width,
		`the widest epilogue line fits: ${widest}px of ${meta.images.backdrop.width} ("${widestText.slice(0, 24)}...")`);
	ok(widest > 100, 'and is not suspiciously narrow, i.e. the widths were read');
}

eq(meta.music.death, 'Death', 'the death screen names its module');
eq(meta.music.outro, 'Outro', 'and the outro names its own');


// --- the ending fires once, at the end -----------------------------------------
//
// COMPLETION.CAMPAIGN_COMPLETE means THIS MISSION finished and is raised by every
// campaign level, so triggering the outro on it rolled the credits after level
// one. completeMission flags the real ending instead.
{
	const shell = await import('../src/shell.js');
	const { COMPLETION } = await import('../src/completion.js');
	const campaign = JSON.parse(fs.readFileSync(
		path.join(A, 'maps', 'campaign.json'), 'utf8'));

	const ends = campaign.locations.filter((l) => l.kind === 'campaignEnd');
	eq(ends.length, 1, 'exactly one location ends the campaign');
	eq(ends[0].key, '21-Spaceport', 'and it is the spaceport');

	const run = (key) => {
		const s = shell.createShell();
		s.lastKey = key;
		return shell.completeMission(s, campaign,
			{ type: COMPLETION.CAMPAIGN_COMPLETE, complete: true });
	};

	// Every ordinary campaign level: no ending.
	let early = 0;
	for (const l of campaign.locations) {
		if (l.kind === 'campaignEnd') continue;
		if (run(l.key).campaignOver) early++;
	}
	eq(early, 0, 'no other location triggers the outro');
	ok(run('21-Spaceport').campaignOver, 'the spaceport does');
	eq(run('21-Spaceport').music, 'Outro', 'and plays the outro module');
	eq(run('01-ArtificialIsland').music, 'Front', 'while an ordinary level returns to the menu');

	// Death is flagged separately, and not as the ending.
	const s = shell.createShell();
	s.lastKey = '01-ArtificialIsland';
	const dead = shell.completeMission(s, campaign,
		{ type: COMPLETION.DEATH, complete: true });
	ok(dead.died, 'a wipe is flagged');
	ok(!dead.campaignOver, 'and is not the ending');
	eq(dead.music, 'Death', 'and plays the death module');
}

console.log(`endscreens: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
