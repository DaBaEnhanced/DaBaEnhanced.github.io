// Runtime patching for per-map monster graphics.
//
// Style files leave mon1*/mon2*/monsterNdead as placeholders. The original
// loads up to two monster .gfx bundles per map and copies their BOBs into those
// placeholders before rendering. This mirrors that by appending the decoded
// monster atlas below the style atlas and redirecting the placeholder slots.

function cloneStyleForMonsterPatch(style) {
	return {
		...style,
		graphics: style.graphics.map((g) => ({
			...g,
			slots: g.slots ? g.slots.map((s) => s ? { ...s } : null) : g.slots,
		})),
		atlas: { ...style.atlas },
	};
}

function copyMonsterPartToAtlas(part, srcAtlas, dstAtlas, dstWidth, yOffset) {
	for (const slot of part.slots || []) {
		if (!slot) continue;
		for (let y = 0; y < slot.h; y++) {
			const src = (slot.ay + y) * srcAtlas.width + slot.ax;
			const dst = (yOffset + slot.ay + y) * dstWidth + slot.ax;
			dstAtlas.set(srcAtlas.data.subarray(src, src + slot.w), dst);
		}
	}
}

function copySingleSlotToAtlas(slot, srcAtlas, dstAtlas, dstWidth, yOffset) {
	if (!slot) return;
	for (let y = 0; y < slot.h; y++) {
		const src = (slot.ay + y) * srcAtlas.width + slot.ax;
		const dst = (yOffset + slot.ay + y) * dstWidth + slot.ax;
		dstAtlas.set(srcAtlas.data.subarray(src, src + slot.w), dst);
	}
}

function patchedPart(part, yOffset) {
	return {
		planeOps: part.planeOps || [1, 1, 1, 1, 2, 0],
		planeOnly: !!part.planeOnly,
		slots: (part.slots || []).map((s) => s ? { ...s, ay: s.ay + yOffset } : null),
	};
}

export function mapHasMonsterNumber(cells, seen, monsterDefs, number) {
	const defs = monsterDefs?.monsters || monsterDefs || [];
	if (!defs || !seen || !cells) return false;
	for (let i = 0; i < cells.length; i++) {
		if (!(cells[i] & (1 << 5)) || ((cells[i] >>> 28) & 15) !== 0) continue;
		const type = (seen[i] >>> 12) & 0xff;
		if (defs[type]?.monsterNumber === number) return true;
	}
	return false;
}

export function mapMonsterNumbers(map, cells, seen, monsterDefs) {
	return [
		map.locn.mons1 || (mapHasMonsterNumber(cells, seen, monsterDefs, 20) ? 20 : 0),
		map.locn.mons2 || 0,
	];
}

export function patchStyleMonsters(baseStyle, baseAtlas, monsterGraphics, monsterAtlas, numbers) {
	if (!monsterGraphics || !monsterAtlas || !baseStyle || !baseAtlas) {
		return { style: baseStyle, atlas: baseAtlas };
	}
	const monsterRecord = (number) =>
		monsterGraphics.monsters?.find((m) => m.number === number) || null;
	const records = (numbers || []).map(monsterRecord);
	if (!records[0] && !records[1]) return { style: baseStyle, atlas: baseAtlas };

	const yOffset = baseAtlas.height;
	const aw = Math.max(baseAtlas.width, monsterAtlas.width);
	const ah = baseAtlas.height + monsterAtlas.height;
	const atlas = new Uint8Array(aw * ah);
	for (let y = 0; y < baseAtlas.height; y++) {
		const src = y * baseAtlas.width;
		atlas.set(baseAtlas.data.subarray(src, src + baseAtlas.width), y * aw);
	}
	const style = cloneStyleForMonsterPatch(baseStyle);
	const patch = (gfxIndex, record, partName) => {
		const part = record?.parts?.[partName];
		if (!part) return;
		copyMonsterPartToAtlas(part, monsterAtlas, atlas, aw, yOffset);
		style.graphics[gfxIndex] = {
			...style.graphics[gfxIndex],
			present: true,
			runtimeLoaded: true,
			source: record.source,
			...patchedPart(part, yOffset),
		};
	};
	const attackPart = (record) => record?.parts?.attack || null;
	const patchAttack = (gfxIndex, record) => {
		const part = attackPart(record);
		const src = part?.slots?.[0];
		const dst = style.graphics[gfxIndex]?.slots?.[57];
		if (!part || !src || !dst) return;
		copySingleSlotToAtlas(src, monsterAtlas, atlas, aw, yOffset);
		style.graphics[gfxIndex].attack = {
			planeOps: part.planeOps || [1, 1, 1, 1, 2, 0],
			planeOnly: !!part.planeOnly,
			slot: { ...src, ay: src.ay + yOffset },
		};
	};

	patch(13, records[0], 'front');
	patch(14, records[0], 'left');
	patch(15, records[0], 'right');
	patch(16, records[0], 'back');
	patch(46, records[0], 'dead');
	patch(17, records[1], 'front');
	patch(18, records[1], 'left');
	patch(19, records[1], 'right');
	patch(20, records[1], 'back');
	patch(47, records[1], 'dead');
	patchAttack(13, records[0]);
	patchAttack(17, records[1]);
	if ((baseStyle.style | 0) === 4 && records[0]?.number === 20) {
		// Drawviews.s uses mon2in_bob for style 5's Monster20 attack frame even
		// though put_monster_in_map stamps Gargoyle into monster slot 1.
		patchAttack(13, records[1] || records[0]);
	}

	style.atlas = { ...style.atlas, width: aw, height: ah };
	return { style, atlas: { width: aw, height: ah, data: atlas } };
}
