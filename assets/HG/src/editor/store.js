// Where custom maps live.
//
// The 47 shipped maps stay read-only: a custom map may be *opened from* one,
// but it always saves as a new entry. Storage is IndexedDB rather than
// localStorage because a single map is ~130KB of binary (three u32 layers over
// 10,580 cells, plus panels and horizons) and localStorage is a string store
// with a few megabytes to its name -- a dozen maps would fill it.

const DB_NAME = 'hiredguns-editor';
const DB_VERSION = 1;
const STORE = 'maps';

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx(db, mode, fn) {
	return new Promise((resolve, reject) => {
		const t = db.transaction(STORE, mode);
		const req = fn(t.objectStore(STORE));
		t.oncomplete = () => resolve(req?.result);
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error);
	});
}

/** Custom map keys are namespaced so they can never shadow a shipped map. */
export const CUSTOM_PREFIX = 'custom/';

export const isCustomKey = (key) => String(key).startsWith(CUSTOM_PREFIX);
export const customKey = (name) => CUSTOM_PREFIX + String(name).replace(/[^\w -]/g, '').trim();

/**
 * Save a serialised document. `record` is what serializeMapDoc returned, plus
 * the name to show in menus.
 */
export async function saveCustomMap(key, serialised, name = key) {
	const db = await openDb();
	try {
		await tx(db, 'readwrite', (s) => s.put({
			key,
			name,
			savedAt: new Date().toISOString(),
			json: serialised.json,
			cells: serialised.cells,
			panels: serialised.panels,
			horizon: serialised.horizon,
		}));
	} finally {
		db.close();
	}
	return key;
}

export async function loadCustomMap(key) {
	const db = await openDb();
	try {
		return (await tx(db, 'readonly', (s) => s.get(key))) || null;
	} finally {
		db.close();
	}
}

export async function listCustomMaps() {
	const db = await openDb();
	try {
		const all = (await tx(db, 'readonly', (s) => s.getAll())) || [];
		// Newest first, which is the order someone iterating on a map wants.
		return all
			.map(({ key, name, savedAt }) => ({ key, name, savedAt }))
			.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
	} finally {
		db.close();
	}
}

export async function deleteCustomMap(key) {
	const db = await openDb();
	try {
		await tx(db, 'readwrite', (s) => s.delete(key));
	} finally {
		db.close();
	}
}

/**
 * A custom map as one portable file: the JSON with its binaries inlined as
 * base64, so a map can be handed to someone else.
 */
/**
 * The filename a bundled map ships under.
 *
 * The same file serves two jobs: a backup you can pass around, and a static
 * asset the shipped game fetches. Keeping one format means an exported map can
 * be dropped into assets/maps/ and played without any conversion step.
 */
export const BUNDLE_EXT = '.hgmap.json';
export const bundleName = (name) =>
	`${String(name).replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-')}${BUNDLE_EXT}`;

/**
 * Base64 in chunks.
 *
 * `String.fromCharCode(...bytes)` spreads every byte into an argument list, and
 * the cells layer alone is 126,960 of them -- well past what an engine will
 * accept, so it threw RangeError on any real map rather than only on a large
 * one. 32k a chunk stays clear of that everywhere.
 */
function toBase64(bytes) {
	if (!bytes) return null;
	const CHUNK = 0x8000;
	let s = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
	}
	return btoa(s);
}

export function exportCustomMap(record) {
	const b64 = toBase64;
	return JSON.stringify({
		format: 'hiredguns-map',
		version: 1,
		name: record.name,
		json: record.json,
		cells: b64(record.cells),
		panels: b64(record.panels),
		horizon: b64(record.horizon),
	});
}

export function importCustomMap(text) {
	const data = JSON.parse(text);
	if (data.format !== 'hiredguns-map') throw new Error('not a Hired Guns map file');
	const bytes = (s) => (s ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : null);
	return {
		name: data.name || 'imported map',
		json: data.json,
		cells: bytes(data.cells),
		panels: bytes(data.panels),
		horizon: bytes(data.horizon),
	};
}
