'use strict';
// Build the campaign/action/training location tables from extracted map JSON.

const fs = require('fs');
const path = require('path');

const MAPS = path.resolve(__dirname, '..', 'assets', 'maps');
const OUT = path.join(MAPS, 'campaign.json');

function mapNum(key) {
	const m = /^(\d+)/.exec(key);
	return m ? Number(m[1]) : 0;
}

function clean(text) {
	return String(text || '').split('~')[0].replace(/\s+/g, ' ').trim();
}

function classify(n, locn) {
	if (n >= 43 && n <= 47) return 'training';
	if (n >= 23 && n <= 27) return 'action1';
	if (n >= 28 && n <= 32) return 'action2';
	if (n >= 33 && n <= 37) return 'action3';
	if (n >= 38 && n <= 42) return 'action4';
	if (n >= 1 && n <= 22) {
		if (n === 16 || n === 22) return 'unused';
		if ((locn.typeFlag | 0) === 3) return 'campaignEnd';
		if ((locn.typeFlag | 0) === 2) return 'campaignStart';
		return 'campaign';
	}
	return 'unused';
}

function main() {
	const files = fs.readdirSync(MAPS).filter((f) => f.endsWith('.json') && f !== 'maps.json' && f !== 'campaign.json');
	const locations = [];
	for (const file of files) {
		const m = JSON.parse(fs.readFileSync(path.join(MAPS, file), 'utf8'));
		const n = mapNum(m.key);
		const locn = m.locn || {};
		const kind = classify(n, locn);
		if (kind === 'unused') continue;
		locations.push({
			key: m.key,
			mapNum: n,
			kind,
			typeFlag: locn.typeFlag | 0,
			players: locn.players | 0,
			x: locn.x | 0,
			y: locn.y | 0,
			name: clean(locn.legend2) || clean(m.key),
			info: clean(locn.info),
			destinations: (locn.destinations || []).map((d) => d | 0),
			musicNum: locn.musicNum | 0,
			atmos: locn.atmos | 0,
		});
	}
	locations.sort((a, b) => a.mapNum - b.mapNum);
	const starts = locations.filter((l) => l.kind === 'campaignStart').map((l) => l.mapNum);
	fs.writeFileSync(OUT, JSON.stringify({
		source: 'assets/maps/*.json locn records / Front.s:1651 / Equates.i locn_type_flag',
		starts,
		locations,
	}, null, '\t'));
	console.log(`campaign: ${locations.length} locations, starts ${starts.join(',')}`);
}

main();
