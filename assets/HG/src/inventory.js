// Inventory and item helpers, ported from Controls&Movement.s.
//
// Runtime item numbers are 1-based. Item 0 means an empty hand/slot. Each slot
// is the four-byte inven_item structure: num, damage, ammo, outlined.

import { LEVEL_CELLS } from './view.js';

export const INVENTORY_SIZE = 30;

export const CATEGORY = {
	GUN: 0,
	MINE: 2,
	AMMO: 4,
	FOOD: 5,
	KEY: 6,
	DTS: 9,
	PSIAMP: 12,
	ARMED_MINE: 13,
	FLAMER: 15,
	LAUNCHER: 16,
	IMMU: 18,
	REPAIR: 19,
	GRLAUNCHER: 20,
	GRENADE: 21,
	NUKE: 22,
	SENTRY: 23,
	SENTRYCNTRL: 25,
};

const FLOOR_HERE = 1;
const AUX_HERE = 1 << 5;
const BLOCK_HERE = 1 << 1;
const SHIFT = { aux: 28, itemDamage: 8, itemAmmo: 16 };
const MASK = { aux: 0xf };
const KEEP_AUX = AUX_HERE | (MASK.aux << SHIFT.aux);
const ITEM_DATA_MASK = 0x00ffffff;
const AUX_SKELETON = 7;
const AUX_CONTAINER_FIRST = 2;
const AUX_CONTAINER_LAST = 6;
const AUX_DATA_MASK = 0x000ff000;
const AUX_DATA_SHIFT = 12;

const ammoWeighted = new Set([CATEGORY.AMMO, CATEGORY.GRENADE, CATEGORY.SENTRY]);
// spell_wings holds the psi's own item number; 24 is the feather that makes the
// party weightless. Any other value is a different wings effect and does not.
const WINGS_WEIGHTLESS = 24;
const reloadable = new Set([
	CATEGORY.GUN, CATEGORY.FLAMER, CATEGORY.LAUNCHER, CATEGORY.GRLAUNCHER,
]);

export function emptyItem() {
	return { num: 0, damage: 0, ammo: 0, outlined: 0 };
}

export function cloneItem(item) {
	if (!item || !item.num) return emptyItem();
	return {
		num: item.num & 255,
		damage: item.damage & 255,
		ammo: item.ammo & 255,
		outlined: item.outlined ? 255 : 0,
	};
}

export function hasItem(item) {
	return !!(item && item.num);
}

export function createInventory(character) {
	const inv = {
		pos: 0,
		using: emptyItem(),
		store: Array.from({ length: INVENTORY_SIZE }, emptyItem),
		numItems: 0,
		weight: 0,
	};
	for (const item of character?.inventory || []) {
		if (item.slot < 0 || item.slot >= INVENTORY_SIZE || !item.item) continue;
		inv.store[item.slot] = {
			num: item.item & 255,
			damage: item.damage & 255,
			ammo: item.ammo & 255,
			outlined: item.potency ? 255 : 0,
		};
	}
	return inv;
}

/**
 * Fill `inv` with the given item numbers, up to INVENTORY_SIZE. Cheat support:
 * items land fully repaired with a full ammo byte so everything is usable.
 *
 * @returns the number of slots filled.
 */
export function stockInventory(inv, itemNums) {
	if (!inv) return 0;
	let n = 0;
	for (const num of itemNums) {
		if (n >= INVENTORY_SIZE) break;
		if (!num) continue;
		inv.store[n] = { num: num & 255, damage: 0, ammo: 255, outlined: 0 };
		n++;
	}
	for (let i = n; i < INVENTORY_SIZE; i++) inv.store[i] = emptyItem();
	inv.pos = 0;
	return n;
}

export function itemMeta(itemsData, item) {
	const n = typeof item === 'number' ? item : item?.num;
	if (!n) return null;
	return itemsData?.items?.[n - 1] || null;
}

export function itemName(itemsData, item) {
	const meta = itemMeta(itemsData, item);
	if (!meta) return '';
	return meta.header.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function itemWeight(itemsData, item) {
	const meta = itemMeta(itemsData, item);
	if (!meta) return 0;
	const base = meta.weight | 0;
	return ammoWeighted.has(meta.category) ? base * (item.ammo & 255) : base;
}

export function calcInventoryWeight(inv, itemsData) {
	let weight = itemWeight(itemsData, inv.using);
	for (const item of inv.store) weight += itemWeight(itemsData, item);
	return weight;
}

export function countInventoryItems(inv) {
	let n = hasItem(inv.using) ? 1 : 0;
	for (const item of inv.store) if (hasItem(item)) n++;
	return n;
}

export function refreshInventory(player, itemsData) {
	const inv = player.inventory;
	if (!inv) return;
	inv.weight = calcInventoryWeight(inv, itemsData);
	// The wings/feather psi zeroes carried weight outright before the tooheavy
	// test (Controls&Movement.s:5960 `cmpi.w #24,spell_wings / moveq #0,d2`).
	// Without this the spell sets its icon and duration but does nothing.
	if (player.spellWings === WINGS_WEIGHTLESS) inv.weight = 0;
	inv.numItems = countInventoryItems(inv);
	player.stats.weight = inv.weight;
	// `noWeightLimit` is the cheat's infinite carry capacity. Kept separate from
	// the wings psi above: that zeroes the carried weight (so the HUD reads 0),
	// this leaves the weight visible but stops it ever blocking you.
	player.tooHeavy = !player.noWeightLimit &&
		Math.floor(inv.weight / 140) > (player.stats.physique | 0);
	player.usingGrenade = itemMeta(itemsData, inv.using)?.category === CATEGORY.GRENADE;
}

function damageItemSlot(item, itemsData, amount) {
	if (!hasItem(item) || amount <= 0) return false;
	const meta = itemMeta(itemsData, item);
	const max = meta?.maxDamage | 0;
	if (!max) return false;
	const scaled = ((item.damage & 255) << 8) + (amount | 0);
	if (scaled >= max) {
		if (meta.containerType === 6) item.num = 52;
		else if (meta.containerType === 5) item.num = 111;
		else item.num = 22;
		item.damage = 0;
		item.ammo = 0;
		item.outlined = 0;
		return true;
	}
	item.damage = (scaled >>> 8) & 255;
	return true;
}

export function damageInventory(player, itemsData, hit) {
	const inv = player?.inventory;
	if (!inv || hit <= 0) return false;
	refreshInventory(player, itemsData);
	if (!inv.numItems) return false;
	const perItem = Math.floor((hit >>> 1) / inv.numItems);
	let changed = damageItemSlot(inv.using, itemsData, perItem);
	for (const item of inv.store) {
		if (damageItemSlot(item, itemsData, perItem)) changed = true;
	}
	if (changed) refreshInventory(player, itemsData);
	return changed;
}

export function damageInventoryByWater(player, itemsData) {
	if (player?.spellWater === 100) return false;
	const inv = player?.inventory;
	if (!inv) return false;
	let changed = false;
	const apply = (item) => {
		const meta = itemMeta(itemsData, item);
		const water = meta?.waterDamage | 0;
		if (water && damageItemSlot(item, itemsData, water << 8)) changed = true;
	};
	apply(inv.using);
	for (const item of inv.store) apply(item);
	if (changed) refreshInventory(player, itemsData);
	return changed;
}

export function clearNewItems(inv) {
	if (!inv) return;
	inv.using.outlined = 0;
	for (const item of inv.store) item.outlined = 0;
}

export function scrollInventory(inv, dir) {
	if (dir < 0) {
		if (inv.pos <= 0) return false;
		inv.pos--;
		return true;
	}
	if (inv.pos >= INVENTORY_SIZE - 1) return false;
	if (!hasItem(inv.store[inv.pos + 1])) return false;
	inv.pos++;
	return true;
}

function full(inv) {
	return hasItem(inv.store[INVENTORY_SIZE - 1]);
}

export function insertItem(inv, item) {
	if (!hasItem(item) || full(inv)) return false;
	for (let i = INVENTORY_SIZE - 1; i > inv.pos; i--) {
		inv.store[i] = cloneItem(inv.store[i - 1]);
	}
	inv.store[inv.pos] = cloneItem(item);
	return true;
}

export function removeStoreItem(inv, index = inv.pos) {
	if (index < 0 || index >= INVENTORY_SIZE || !hasItem(inv.store[index])) {
		return emptyItem();
	}
	const removed = cloneItem(inv.store[index]);
	for (let i = index; i < INVENTORY_SIZE - 1; i++) {
		inv.store[i] = cloneItem(inv.store[i + 1]);
	}
	inv.store[INVENTORY_SIZE - 1] = emptyItem();
	if (!hasItem(inv.store[inv.pos]) && inv.pos > 0) inv.pos--;
	return removed;
}

export function takeOrSwapSelected(inv) {
	const selected = inv.store[inv.pos];
	if (!hasItem(selected)) return { changed: false, reason: 'empty' };
	if (!hasItem(inv.using)) {
		inv.using = removeStoreItem(inv, inv.pos);
		return { changed: true, mode: 'take' };
	}
	const tmp = cloneItem(inv.using);
	inv.using = cloneItem(selected);
	inv.store[inv.pos] = tmp;
	return { changed: true, mode: 'swap' };
}

export function storeHeldItem(inv) {
	if (!hasItem(inv.using)) return { changed: false, reason: 'empty' };
	if (!insertItem(inv, inv.using)) return { changed: false, reason: 'full' };
	inv.using = emptyItem();
	return { changed: true };
}

function skeletonOwner(seenLayer, players, cell) {
	if (!seenLayer || !players || cell < 0 || cell >= seenLayer.length) return null;
	const owner = (seenLayer[cell] & AUX_DATA_MASK) >>> AUX_DATA_SHIFT;
	return players[owner] || null;
}

// Drawviews.s:3427 -- underfoot skeleton shows inven_using, else store[0] only.
export function skeletonUnderfootAux(seenLayer, players, itemsData, cell) {
	const owner = skeletonOwner(seenLayer, players, cell);
	const inv = owner?.inventory;
	if (!inv) return 0;
	const num = hasItem(inv.using) ? inv.using.num : (inv.store[0]?.num || 0);
	if (!num) return 0;
	return itemMeta(itemsData, num)?.containerType | 0;
}

function firstSkeletonItem(owner) {
	const inv = owner?.inventory;
	if (!inv) return null;
	if (hasItem(inv.using)) return { place: 'using', item: inv.using };
	for (let i = 0; i < INVENTORY_SIZE; i++) {
		if (hasItem(inv.store[i])) return { place: 'store', index: i, item: inv.store[i] };
	}
	return null;
}

function removeSkeletonItem(owner, found) {
	if (!owner?.inventory || !found) return emptyItem();
	if (found.place === 'using') {
		const item = cloneItem(owner.inventory.using);
		owner.inventory.using = emptyItem();
		return item;
	}
	return removeStoreItem(owner.inventory, found.index);
}

function putSkeletonItem(owner, item) {
	if (!owner?.inventory || !hasItem(item)) return false;
	for (let i = 0; i < INVENTORY_SIZE; i++) {
		if (!hasItem(owner.inventory.store[i])) {
			owner.inventory.store[i] = cloneItem(item);
			return true;
		}
	}
	if (!hasItem(owner.inventory.using)) {
		owner.inventory.using = cloneItem(item);
		return true;
	}
	return false;
}

function looseItemAt(cells, itemsLayer, cell, seenLayer = null, players = null) {
	if (cell < 0 || cell >= cells.length || !(cells[cell] & AUX_HERE)) return null;
	const aux = (cells[cell] >>> SHIFT.aux) & MASK.aux;
	if (aux === AUX_SKELETON) {
		const owner = skeletonOwner(seenLayer, players, cell);
		const found = firstSkeletonItem(owner);
		return { skeleton: true, owner, item: found ? cloneItem(found.item) : null };
	}
	if (aux < AUX_CONTAINER_FIRST || aux > AUX_CONTAINER_LAST) return null;
	const word = itemsLayer[cell] >>> 0;
	const num = word & 255;
	if (!num) return null;
	return {
		num,
		damage: (word >>> SHIFT.itemDamage) & 255,
		ammo: (word >>> SHIFT.itemAmmo) & 255,
		outlined: 0,
	};
}

export function hasLooseItem(cells, itemsLayer, cell) {
	return !!looseItemAt(cells, itemsLayer, cell);
}

export function peekLooseItem(cells, itemsLayer, cell, seenLayer = null, players = null) {
	const loose = looseItemAt(cells, itemsLayer, cell, seenLayer, players);
	if (!loose) return null;
	if (loose.skeleton) return loose.item ? cloneItem(loose.item) : null;
	return cloneItem(loose);
}

function clearLooseItem(cells, cell) {
	cells[cell] = (cells[cell] & ~KEEP_AUX) >>> 0;
}

export function pickUpIntoInventory(player, cells, itemsLayer, itemsData, cell,
		seenLayer = null, players = null) {
	const inv = player.inventory;
	if (player.tooHeavy) return { changed: false, reason: 'heavy' };
	const loose = looseItemAt(cells, itemsLayer, cell, seenLayer, players);
	if (!loose) return { changed: false, reason: 'empty' };
	if (loose.skeleton) {
		const owner = loose.owner;
		const found = firstSkeletonItem(owner);
		if (!found) return { changed: false, reason: 'empty' };
		if (!insertItem(inv, { ...found.item, outlined: 0 })) {
			return { changed: false, reason: 'full' };
		}
		const item = removeSkeletonItem(owner, found);
		refreshInventory(owner, itemsData);
		refreshInventory(player, itemsData);
		return { changed: true, item, skeleton: true };
	}
	if (!insertItem(inv, { ...loose, outlined: 0 })) {
		return { changed: false, reason: 'full' };
	}
	clearLooseItem(cells, cell);
	refreshInventory(player, itemsData);
	return { changed: true, item: loose };
}

export function pickUpToHand(player, cells, itemsLayer, itemsData, cell,
		seenLayer = null, players = null) {
	const inv = player.inventory;
	if (player.tooHeavy) return { changed: false, reason: 'heavy' };
	const loose = looseItemAt(cells, itemsLayer, cell, seenLayer, players);
	if (!loose) return { changed: false, reason: 'empty' };
	if (loose.skeleton) {
		const owner = loose.owner;
		const found = firstSkeletonItem(owner);
		if (!found) return { changed: false, reason: 'empty' };
		if (hasItem(inv.using) && !insertItem(inv, inv.using)) {
			return { changed: false, reason: 'full' };
		}
		const item = removeSkeletonItem(owner, found);
		inv.using = cloneItem(item);
		refreshInventory(owner, itemsData);
		refreshInventory(player, itemsData);
		return { changed: true, item, skeleton: true };
	}
	if (hasItem(inv.using) && !insertItem(inv, inv.using)) {
		return { changed: false, reason: 'full' };
	}
	inv.using = cloneItem(loose);
	clearLooseItem(cells, cell);
	refreshInventory(player, itemsData);
	return { changed: true, item: loose };
}

function canDropAt(cells, cell) {
	if (cell < 0 || cell >= cells.length) return false;
	if (cells[cell] & AUX_HERE) return false;
	if (cells[cell] & FLOOR_HERE) return true;
	const below = cell - LEVEL_CELLS;
	return below >= 0 && (cells[below] & BLOCK_HERE);
}

function putLooseItem(cells, itemsLayer, itemsData, cell, item,
		seenLayer = null, players = null) {
	if (cell >= 0 && cell < cells.length && (cells[cell] & AUX_HERE) &&
			(((cells[cell] >>> SHIFT.aux) & MASK.aux) === AUX_SKELETON)) {
		const owner = skeletonOwner(seenLayer, players, cell);
		return putSkeletonItem(owner, item);
	}
	const meta = itemMeta(itemsData, item);
	if (!meta || !canDropAt(cells, cell)) return false;
	const aux = meta.containerType | 0;
	if (!aux) return false;
	cells[cell] = (cells[cell] | AUX_HERE | (aux << SHIFT.aux)) >>> 0;
	itemsLayer[cell] = ((itemsLayer[cell] & ~ITEM_DATA_MASK) |
		(item.num & 255) |
		((item.damage & 255) << SHIFT.itemDamage) |
		((item.ammo & 255) << SHIFT.itemAmmo)) >>> 0;
	return true;
}

export function dropHeldItem(player, cells, itemsLayer, itemsData, cell,
		seenLayer = null, players = null) {
	const inv = player.inventory;
	if (!hasItem(inv.using)) return { changed: false, reason: 'empty' };
	if (!putLooseItem(cells, itemsLayer, itemsData, cell, inv.using, seenLayer, players)) {
		return { changed: false, reason: 'no_room' };
	}
	const dropped = cloneItem(inv.using);
	inv.using = emptyItem();
	refreshInventory(player, itemsData);
	const owner = skeletonOwner(seenLayer, players, cell);
	if (owner) refreshInventory(owner, itemsData);
	return { changed: true, item: dropped };
}

export function dropSelectedItem(player, cells, itemsLayer, itemsData, cell,
		seenLayer = null, players = null) {
	const inv = player.inventory;
	const selected = inv.store[inv.pos];
	if (!hasItem(selected)) return { changed: false, reason: 'empty' };
	if (!putLooseItem(cells, itemsLayer, itemsData, cell, selected, seenLayer, players)) {
		return { changed: false, reason: 'no_room' };
	}
	const dropped = removeStoreItem(inv, inv.pos);
	refreshInventory(player, itemsData);
	const owner = skeletonOwner(seenLayer, players, cell);
	if (owner) refreshInventory(owner, itemsData);
	return { changed: true, item: dropped };
}

function gunSpec(meta) {
	if (!meta) return null;
	const raw = meta.raw || [];
	return {
		clips: meta.gun?.clips || [raw[7] || 0, raw[8] || 0, raw[9] || 0],
		maxRounds: meta.gun?.maxRounds || raw[10] || 0,
	};
}

function findCarried(inv, num) {
	if (inv.using.num === num) return { place: 'using', item: inv.using };
	for (let i = 0; i < INVENTORY_SIZE; i++) {
		if (inv.store[i].num === num) return { place: 'store', index: i, item: inv.store[i] };
	}
	return null;
}

export function carryingItem(inv, num) {
	return inv ? findCarried(inv, num) : null;
}

export function removeCarriedItem(player, itemsData, num) {
	const inv = player?.inventory;
	const found = inv ? findCarried(inv, num) : null;
	if (!found) return emptyItem();
	const removed = found.place === 'using'
		? cloneItem(inv.using)
		: removeStoreItem(inv, found.index);
	if (found.place === 'using') inv.using = emptyItem();
	refreshInventory(player, itemsData);
	return removed;
}

export function reloadHeldItem(player, itemsData) {
	const inv = player.inventory;
	const heldMeta = itemMeta(itemsData, inv.using);
	if (!heldMeta || !reloadable.has(heldMeta.category)) {
		return { changed: false, reason: 'not_reloadable' };
	}
	const spec = gunSpec(heldMeta);
	if (!spec?.maxRounds || inv.using.ammo >= spec.maxRounds) {
		return { changed: false, reason: 'full' };
	}
	for (const clip of spec.clips) {
		if (!clip) continue;
		const found = findCarried(inv, clip);
		if (!found || found.place !== 'store') continue;
		const needed = spec.maxRounds - inv.using.ammo;
		if (found.item.ammo > needed) {
			found.item.ammo -= needed;
			inv.using.ammo = spec.maxRounds;
		} else {
			inv.using.ammo += found.item.ammo;
			removeStoreItem(inv, found.index);
		}
		refreshInventory(player, itemsData);
		return { changed: true, clip };
	}
	return { changed: false, reason: 'no_ammo' };
}

export function itemFooterLines(itemsData, item) {
	const meta = itemMeta(itemsData, item);
	if (!meta) return [];
	const out = [];
	const footer1 = meta.footer?.[0] || '';
	const footer2 = meta.footer?.[1] || '';
	if (footer1) out.push(footer1.replace(/X+/, String(item.ammo & 255)));
	if (footer2 && meta.maxDamage) {
		const pct = Math.floor(((item.damage & 255) << 8) * 100 / meta.maxDamage);
		out.push(footer2.replace(/X+/, String(pct)));
	} else if (footer2) {
		out.push(footer2);
	}
	return out;
}
