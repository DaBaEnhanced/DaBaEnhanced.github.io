'use strict';
// Extract the game's static data tables: items, monsters and messages.
//
// These live in Data/GameFast.dat as raw binaries beside their assembler
// sources. The sources carry the field comments, the binaries carry the values,
// so the layouts below are taken from Sources/Equates.i and cross-checked
// against the record counts:
//
//   Items.dat     32604 bytes / 286 = 114 items
//   Monsters.dat   1760 bytes /  22 =  80 records (20 types x 4 difficulties)
//   Messages.dat   6048 bytes
//
// Item records are mostly TEXT: four 16-byte name lines and ten 19-byte info
// lines, then the numeric fields, then a 12-byte union whose meaning depends on
// item_category. That union is why the same 286-byte record can describe a gun,
// a mine and a sentry.
//
// Monster records include one pad byte before bravery. The original `rs.w`
// fields are even-aligned, so the post-`mdfn_water_only` word fields start at
// byte 12, not byte 11.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'Data', 'GameFast.dat');
const OUT = path.resolve(__dirname, '..', 'assets');

// item_category values, from the equates at the head of Items.s.
const CATEGORY = {
	0: 'gun', 1: 'hand2hand', 2: 'mine', 4: 'ammo', 5: 'food', 6: 'key',
	7: 'uplink', 8: 'camcorder', 9: 'dts', 11: 'databank', 12: 'psiamp',
	13: 'armed_mine', 15: 'flamer', 16: 'launcher', 17: 'trash', 18: 'immu',
	19: 'repair', 20: 'grlauncher', 21: 'grenade', 22: 'nuke', 23: 'sentry',
	24: 'cellammo', 25: 'sentrycntrl', 26: 'corpse',
};

// item_container_type: which crate or rack a dropped item shows up in.
const CONTAINER = {
	2: 'special', 3: 'consumable', 4: 'psionic', 5: 'smallcrate', 6: 'bigcrate',
};

const ITEM_SIZE = 286, ITEM_HEADER_SIZE = 274;
const MESSAGE_HEADER = 8;
const MONSTER_SIZE = 22;

// Text is not plain ASCII. Every string is written as
//   dc.b CENTREON, <width>, "TEXT", ENDTEXT
// where CENTREON (247) asks the renderer to centre the run on a pixel column
// given by the byte after it, ENDTEXT is 0, and '~' is the font's pad glyph --
// the fixed-width fields are padded out with tildes rather than spaces.
// Values below 32 are colour controls (COL1=1 .. COL3=3).
const CENTREON = 247, ENDTEXT = 0;

function decodeText(buf, off, len) {
	let i = off;
	const end = off + len;
	let centre = null;
	if (buf[i] === CENTREON) { centre = buf[i + 1]; i += 2; }
	let s = '';
	const colours = [];
	for (; i < end; i++) {
		const c = buf[i];
		if (c === ENDTEXT) break;
		if (c < 32) { colours.push(c); continue; }   // colour control
		// The game font puts SPACE at 127 and its pad glyph at 126 ('~'), so
		// neither maps to ASCII. Read literally, every word runs together.
		if (c === 127) { s += ' '; continue; }
		if (c === 126) continue;
		s += String.fromCharCode(c);
	}
	s = s.replace(/\s+$/, '');
	return { text: s, centre, colours };
}

/** Just the readable text of a field. */
function text(buf, off, len) { return decodeText(buf, off, len).text; }

function parseItems(buf) {
	const items = [];
	for (let i = 0; i * ITEM_SIZE < buf.length; i++) {
		const o = i * ITEM_SIZE;
		const info = [];
		for (let n = 0; n < 10; n++) {
			const line = text(buf, o + 64 + n * 19, 19);
			if (line) info.push(line);
		}
		const category = buf[o + 254];
		const item = {
			index: i,
			// Two 16-byte header lines and two footer lines make the four-line
			// name plate the inventory panel draws.
			header: [text(buf, o, 16), text(buf, o + 16, 16)],
			footer: [text(buf, o + 32, 16), text(buf, o + 48, 16)],
			info,
			category, categoryName: CATEGORY[category] || `unknown${category}`,
			image: buf[o + 255],
			containerType: buf[o + 256],
			containerName: CONTAINER[buf[o + 256]] || null,
			waterDamage: buf[o + 257],
			maxDamage: buf.readUInt16BE(o + 258),
			weight: buf.readUInt16BE(o + 260),
			animColour: buf.readUInt16BE(o + 262),
			anim: buf[o + 264],
			animDuration: buf[o + 265],
			flashColour: buf[o + 266],
			sample: buf[o + 267],
			samplePeriod: buf.readUInt16BE(o + 268),
			exSample: buf.readUInt16BE(o + 270),
			exSamplePeriod: buf.readUInt16BE(o + 272),
		};

		// The 12-byte tail is a union keyed on category (Equates.i:856).
		const u = o + ITEM_HEADER_SIZE;
		const fireArcs = () => ({
			front: buf[u + 1], rear: buf[u + 2], right: buf[u + 3],
			left: buf[u + 4], down: buf[u + 5], up: buf[u + 6],
		});
		if (category === 0 || category === 15 || category === 16 || category === 20) {
			item.gun = {
				accuracy: buf[u], fire: fireArcs(),
				clips: [buf[u + 7], buf[u + 8], buf[u + 9]],
				maxRounds: buf[u + 10],
				// "use scaled up by 512" -- the raw byte is not the real figure.
				damagePerHit: buf[u + 11], damagePerHitScaled: buf[u + 11] * 512,
			};
		} else if (category === 1) {
			item.hand = { modifier: buf[u] };
		} else if (category === 2 || category === 13) {
			item.mine = {
				north: buf[u], south: buf[u + 1], east: buf[u + 2], west: buf[u + 3],
				down: buf[u + 4], up: buf[u + 5],
				damage: buf.readUInt16BE(u + 6),
				armedItem: buf[u + 8],
			};
		} else if (category === 5) {
			item.food = {
				fitnessBoost: buf.readUInt16BE(u),
				physiqueBoost: buf.readUInt16BE(u + 2),
				intelligenceBoost: buf.readUInt16BE(u + 4),
				duration: buf.readUInt16BE(u + 6),
			};
		} else if (category === 18) {
			item.immune = { duration: buf.readUInt16BE(u) };
		} else if (category === 19) {
			item.repair = {
				fitnessBoost: buf.readUInt16BE(u),
				physiqueBoost: buf.readUInt16BE(u + 2),
				intelligenceBoost: buf.readUInt16BE(u + 4),
				duration: buf.readUInt16BE(u + 6),
			};
		} else if (category === 21) {
			item.grenade = {
				north: buf[u], south: buf[u + 1], east: buf[u + 2], west: buf[u + 3],
				down: buf[u + 4], up: buf[u + 5],
				radius: buf.readUInt16BE(u + 6),
				type: buf[u + 8], // 0 = explosion, 1 = stun
			};
		} else if (category === 22) {
			item.nuke = { number: buf[u] };
		} else if (category === 12) {
			item.psi = { level: buf[u] };
		}
		// A sentry is described by the same tail read a third way.
		item.sentry = {
			delay: buf.readUInt16BE(u), rounds: buf.readUInt16BE(u + 2),
			physique: buf.readUInt16BE(u + 4), turnFlag: buf[u + 6],
			shootPlayers: buf[u + 7], range: buf[u + 8], density: buf[u + 9],
		};
		item.raw = Array.from(buf.subarray(u, u + 12));
		items.push(item);
	}
	return items;
}

// Characters. ChSelect.s:865 loads "ChSelect/Characters.dat" straight into
// front_player_dat, so the file is a flat array of player_dat records
// (Equates.i:956, 272 bytes each) -- 16320 bytes = 60 records.
//
// That is NOT 60 characters. It is 12 characters in 5 LANGUAGES, laid out one
// language block after another: front_player_dat is declared 4*12*272, and
// Sources/Data/Characters.s has exactly five sections (English, French, German,
// Italian, Spanish). Only the display strings differ between blocks -- the
// stats and starting inventory are identical, so anything but the text should
// be read from the English block.
//
// Unlike the item and message tables these strings are plain: text then
// ENDTEXT, padded with real spaces rather than the font's '~' glyph.
const CHARACTER_SIZE = 272;
const CHARACTERS_PER_LANGUAGE = 12;
const LANGUAGES = ['english', 'french', 'german', 'italian', 'spanish'];
const GENDER = { 0: 'male', 1: 'female', 2: 'n/a' };
const RACE = { 0: 'Human', 1: 'Mech', 2: 'Golem', 3: 'Humanoid', 4: 'Cyborg' };
const CLASS = {
	0: 'Marine', 1: 'Assassin', 2: 'Combat Droid', 3: 'Medic', 4: 'Citizen',
	5: 'Pilot', 6: 'UPBI agent', 7: 'Engineer', 8: 'Slave', 9: 'Marksman',
	10: 'Trooper', 11: 'UPBI Agent', 12: 'Multipurpose', 13: 'Pilot',
	14: 'Porn King', 15: 'Borg', 16: 'Early Cyborg', 17: 'Barbarella',
};

/** Plain ENDTEXT-terminated, space-padded. */
function plainText(buf, off, len) {
	let s = '';
	for (let i = 0; i < len; i++) {
		const c = buf[off + i];
		if (c === ENDTEXT) break;
		s += String.fromCharCode(c);
	}
	return s.trim();
}

/** 10 slots of (item, damage, ammo, potency); item 0 means the slot is empty. */
function inventory(buf, off) {
	const out = [];
	for (let i = 0; i < 10; i++) {
		const n = buf[off + i * 4];
		if (!n) continue;
		out.push({ slot: i, item: n, damage: buf[off + i * 4 + 1],
			ammo: buf[off + i * 4 + 2], potency: buf[off + i * 4 + 3] });
	}
	return out;
}

function parseCharacters(buf) {
	const out = [];
	for (let i = 0; i * CHARACTER_SIZE < buf.length; i++) {
		const o = i * CHARACTER_SIZE;
		const gender = buf[o + 177], race = buf[o + 178], cls = buf[o + 179];
		out.push({
			index: i,
			character: i % CHARACTERS_PER_LANGUAGE,
			language: LANGUAGES[Math.floor(i / CHARACTERS_PER_LANGUAGE)] || 'unknown',
			origin: plainText(buf, o, 33),
			name: plainText(buf, o + 33, 33),
			description: plainText(buf, o + 66, 33),
			classText: plainText(buf, o + 99, 33),
			gameName: plainText(buf, o + 132, 17),
			// Path to the character's portrait/figure art, relative to the game dir.
			gfxPath: plainText(buf, o + 149, 28),
			gender, genderName: GENDER[gender] || String(gender),
			race, raceName: RACE[race] || String(race),
			class: cls, className: CLASS[cls] || String(cls),
			fitness: buf.readUInt16BE(o + 180),
			physique: buf.readUInt16BE(o + 182),
			// "psi/1000 = spell potency multiplier"
			agility: buf.readUInt16BE(o + 184),
			experience: buf.readUInt16BE(o + 186),
			footstepPeriod: buf.readUInt16BE(o + 188),
			gruntPeriod: buf.readUInt16BE(o + 190),
			inventory: inventory(buf, o + 192),
			actions: inventory(buf, o + 232),
		});
	}
	return out;
}

function parseMonsters(buf) {
	const out = [];
	for (let i = 0; i * MONSTER_SIZE < buf.length; i++) {
		const o = i * MONSTER_SIZE;
		out.push({
			index: i,
			// 20 types x 4 records: the four are the difficulty tiers a map picks
			// between, which is why physique and bravery climb across each group.
			type: Math.floor(i / 4), tier: i % 4,
			physique: buf.readUInt16BE(o),
			weaponModifier: buf.readUInt16BE(o + 2),
			speed: buf[o + 4],            // 0 vfast, 1 fast, 2 normal, 3 slow
			fireballDensity: buf[o + 5],  // 1-4, 0 = does not shoot
			poisonStrength: buf[o + 6],
			maxFireDistance: buf[o + 7],
			monsterNumber: buf[o + 8],
			twoHigh: buf[o + 9],
			staysInWater: buf[o + 10],
			bravery: buf.readUInt16BE(o + 12),
			sample: buf.readUInt16BE(o + 14),
			samplePeriod: buf.readUInt16BE(o + 16),
			fireballSpeed: buf[o + 18],
			fireballDecay: buf[o + 19],
			outline: buf[o + 20],
			stunnable: buf[o + 21],
		});
	}
	return out;
}

/**
 * Messages.dat is banked, not a flat string pool. It opens with pairs of
 *   dc.w <number of messages in the bank>, dc.w <offset of the bank>
 * and each bank is an array of word offsets to the strings, all relative to the
 * start of the file. The first bank's offset therefore also gives the size of
 * the header, and so the number of banks.
 */
function parseMessages(buf) {
	const headerEnd = buf.readUInt16BE(2);
	const bankCount = Math.floor(headerEnd / 4);
	const banks = [];
	for (let b = 0; b < bankCount; b++) {
		const count = buf.readUInt16BE(b * 4);
		const at = buf.readUInt16BE(b * 4 + 2);
		const messages = [];
		for (let m = 0; m < count; m++) {
			const ptr = at + m * 2;
			if (ptr + 1 >= buf.length) break;
			const off = buf.readUInt16BE(ptr);
			if (off <= 0 || off >= buf.length) continue;
			// Each message record opens with `dc.l 0,0` -- eight bytes of link
			// scratch the game fills in at runtime -- before its text.
			const at2 = off + MESSAGE_HEADER;
			if (at2 >= buf.length) continue;
			const d = decodeText(buf, at2, buf.length - at2);
			if (d.text) messages.push({ offset: off, ...d });
		}
		banks.push({ bank: b, offset: at, count, messages });
	}
	return banks;
}

const MONSTER_NAMES = fs.existsSync(path.join(REPO, 'Monsters'))
	? fs.readdirSync(path.join(REPO, 'Monsters'))
		.filter((n) => /^\d\d_/.test(n) && !n.endsWith('.info'))
		.sort()
		.map((n) => n.replace(/^\d\d_/, ''))
	: [];

function main() {
	fs.mkdirSync(OUT, { recursive: true });

	const items = parseItems(fs.readFileSync(path.join(DATA, 'Items.dat')));
	const monsters = parseMonsters(fs.readFileSync(path.join(DATA, 'Monsters.dat')));
	const messages = parseMessages(fs.readFileSync(path.join(DATA, 'Messages.dat')));
	// Characters ship with the CD32 build's ChSelect data, not GameFast.
	const charFile = path.join(REPO, 'Test', 'HiredGunsCD32', 'ChSelect', 'Characters.dat');
	const characters = parseCharacters(fs.readFileSync(charFile));

	for (const m of monsters) m.name = MONSTER_NAMES[m.type] || `type${m.type}`;

	fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify({
		source: 'Data/GameFast.dat/Items.dat',
		recordSize: ITEM_SIZE,
		comment: 'Layout from Sources/Equates.i:824. The 12-byte tail is a union ' +
			'keyed on item_category; gun/hand/mine are decoded into named fields ' +
			'and the sentry reading plus the raw bytes are kept alongside.',
		categories: CATEGORY,
		containers: CONTAINER,
		count: items.length,
		items,
	}, null, '\t'));

	fs.writeFileSync(path.join(OUT, 'monsters.json'), JSON.stringify({
		source: 'Data/GameFast.dat/Monsters.dat',
		recordSize: MONSTER_SIZE,
		comment: '20 monster types x 4 difficulty tiers. Names come from the ' +
			'per-monster art directories under Monsters/.',
		count: monsters.length,
		monsters,
	}, null, '\t'));

	fs.writeFileSync(path.join(OUT, 'messages.json'), JSON.stringify({
		source: 'Data/GameFast.dat/Messages.dat',
		comment: 'Banked: a header of (count, offset) word pairs, then per-bank ' +
			'arrays of word offsets. Each message record opens with 8 bytes of ' +
			'link scratch before its CENTREON-prefixed text.',
		bankCount: messages.length,
		totalMessages: messages.reduce((n, b) => n + b.messages.length, 0),
		banks: messages,
	}, null, '\t'));

	fs.writeFileSync(path.join(OUT, 'characters.json'), JSON.stringify({
		source: 'Test/HiredGunsCD32/ChSelect/Characters.dat',
		recordSize: CHARACTER_SIZE,
		comment: 'Flat array of player_dat records (Equates.i:956). Loaded ' +
			'verbatim into front_player_dat by ChSelect.s:865. inventory and ' +
			'actions index the items table.',
		genders: GENDER, races: RACE, classes: CLASS,
		languages: LANGUAGES,
		charactersPerLanguage: CHARACTERS_PER_LANGUAGE,
		count: characters.length,
		// English first for convenience; the rest differ only in their text.
		characters: characters.filter((c) => c.language === 'english'),
		localised: characters.filter((c) => c.language !== 'english'),
	}, null, '	'));

	console.log(`items    ${items.length} records`);
	const named = items.filter((i) => i.header[0]).length;
	console.log(`         ${named} with a name, categories: ` +
		[...new Set(items.map((i) => i.categoryName))].join(', '));
	console.log(`monsters ${monsters.length} records = ${MONSTER_NAMES.length} types x 4 tiers`);
	console.log(`chars    ${characters.length} records = ` +
		`${CHARACTERS_PER_LANGUAGE} characters x ${LANGUAGES.length} languages`);
	console.log(`messages ${messages.length} banks, ` +
		`${messages.reduce((n, b) => n + b.messages.length, 0)} strings`);
}

main();
