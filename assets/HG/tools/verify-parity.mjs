// Regression guard: the browser view module (src/view.js) and the Node software
// reference (tools/lib/viewrender.js) are two independent implementations of
// blit_view. They must produce identical pixels for every start position and
// facing, otherwise the WebGPU path and the oracle have drifted apart.
//
//   node verify-parity.mjs

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require('./lib/hgmap.js');
const R = require('./lib/viewrender.js');
const V = await import('../src/view.js');
const { IndexCompositor } = await import('../src/compositor.js');

const REPO = path.resolve(__dirname, '..', '..');
const A = path.resolve(__dirname, '..', 'assets');
const tables = JSON.parse(fs.readFileSync(path.join(A, 'viewtables.json'), 'utf8'));
const planetFile = path.join(A, 'planet.bin');
const planet = fs.existsSync(planetFile) ? new Uint8Array(fs.readFileSync(planetFile)) : null;
// The four miscgfx mask sets: slot tables plus their coverage bitmaps.
function loadMasks(name) {
	const meta = JSON.parse(fs.readFileSync(path.join(A, `${name}.json`), 'utf8'));
	return [meta, { width: meta.atlas.width,
		data: new Uint8Array(fs.readFileSync(path.join(A, meta.atlas.file))) }];
}
const [lights, lightAtlas] = loadMasks('lights');
const [water, waterAtlas] = loadMasks('water');
const [explosions, explosionAtlas] = loadMasks('explosions');
const [foam, foamAtlas] = loadMasks('foam');
const overlays = { light: lightAtlas, water: waterAtlas,
	explosions: explosionAtlas, foam: foamAtlas };
let skeleton = null, skeletonAtlas = null;
try {
	skeleton = JSON.parse(fs.readFileSync(path.join(A, 'skeleton.json'), 'utf8'));
	skeletonAtlas = {
		width: skeleton.atlas.width,
		data: new Uint8Array(fs.readFileSync(path.join(A, skeleton.atlas.file))),
		slots: skeleton.slots || [],
	};
	overlays.skeleton = skeletonAtlas;
} catch (_) { /* optional until assets are rebuilt */ }

const styleCache = new Map();
function loadStyle(n) {
	if (styleCache.has(n)) return styleCache.get(n);
	const style = JSON.parse(fs.readFileSync(path.join(A, `style${n}.json`), 'utf8'));
	const atlas = {
		width: style.atlas.width, height: style.atlas.height,
		data: new Uint8Array(fs.readFileSync(path.join(A, style.atlas.file))),
	};
	const entry = { style, atlas };
	styleCache.set(n, entry);
	return entry;
}

function mapFiles() {
	const out = [];
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.toLowerCase().endsWith('.map')) out.push(p);
		}
	};
	walk(path.join(REPO, 'Maps', 'Game'));
	return out.sort();
}

/** Decode the 36 text panels the same way build-maps.js does. */
function readPanels(raw, offset) {
	const W = 48, H = 40, RB = 6, SZ = RB * H * 2;
	const out = new Uint8Array(36 * W * H);
	for (let p = 0; p < 36; p++) {
		for (let plane = 0; plane < 2; plane++) {
			for (let y = 0; y < H; y++) {
				const row = offset + p * SZ + (plane * H + y) * RB;
				for (let x = 0; x < W; x++) {
					if ((raw[row + (x >> 3)] >> (7 - (x & 7))) & 1) out[p * W * H + y * W + x] |= (1 << plane);
				}
			}
		}
	}
	return out;
}

let checked = 0, mismatches = 0;
for (const file of mapFiles()) {
	const raw = fs.readFileSync(file);
	const map = M.parseMap(raw);
	const { style, atlas } = loadStyle(map.locn.style);
	const horizon = raw.subarray(map.header.horizonsOffset, map.header.horizonsOffset + 4 * 576);
	const panels = readPanels(raw, map.header.textPanelsOffset);

	for (const st of map.header.starts) {
		for (let dir = 0; dir < 4; dir++) {
			const base = M.cellIndex(st.x, st.y, st.floor);
			const ref = R.renderView({
				cells: map.cells, base, direction: dir, tables, style, atlas,
				items: map.items, horizon, planet, panels,
				lights, lightAtlas, water, waterAtlas,
				explosions, explosionAtlas, foam, foamAtlas,
				skeleton, skeletonAtlas,
			});

			// Re-composite through the browser module's own draw list AND its own
			// compositor. Re-implementing the blit here is what let this harness
			// drift out of step with the code it is supposed to guard, so it now
			// drives the real IndexCompositor and reads the pane's 3D window back.
			const comp = new IndexCompositor();
			comp.clear();
			if (V.hasSky(map.items, base, dir)) {
				comp.fillBackground(0, 0, V.VIEW_X, V.VIEW_Y, false);
				comp.drawSpans(V.planetSpans(planet, dir), V.PLANET_COLOUR,
					0, 0, V.VIEW_X, V.VIEW_Y, 0);
				const h = V.horizonSpans(horizon, dir);
				comp.drawSpans(h.far, V.HORIZON_FAR_COLOUR, 0, 0, V.VIEW_X, V.VIEW_Y, 0);
				comp.drawSpans(h.near, V.HORIZON_NEAR_COLOUR, 0, 0, V.VIEW_X, V.VIEW_Y, 0);
			}
			const list = V.buildDrawList({
				cells: map.cells, items: map.items, x: st.x, y: st.y, floor: st.floor,
				direction: dir, tables, style,
				lights, water, explosions, foam, panels: { count: 36 },
			});
			comp.drawView(list, atlas, 0, 0, V.VIEW_X, V.VIEW_Y, overlays, panels);

			const buf = new Uint8Array(V.VIEW_W * V.VIEW_H);
			for (let y = 0; y < V.VIEW_H; y++) {
				const src = (V.VIEW_Y + y) * V.SCREEN_W + V.VIEW_X;
				buf.set(comp.indices.subarray(src, src + V.VIEW_W), y * V.VIEW_W);
			}

			let diff = 0;
			for (let i = 0; i < buf.length; i++) if (buf[i] !== ref.pixels[i]) diff++;
			checked++;
			if (diff) {
				mismatches++;
				if (mismatches <= 5) {
					console.log(`MISMATCH ${path.basename(file)} dir${dir} at ` +
						`${st.x},${st.y}@${st.floor}  ${diff} pixels`);
				}
			}
		}
	}
}
console.log(`${checked} view comparisons across ${mapFiles().length} maps, ${mismatches} mismatches`);
process.exit(mismatches ? 1 : 0);
