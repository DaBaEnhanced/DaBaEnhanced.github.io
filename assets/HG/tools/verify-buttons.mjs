// Smoke test for panel/block button interactions.

import { LEVEL_CELLS } from '../src/view.js';
import {
	ACTION, createButtonState, activatePanel, stepButtons,
} from '../src/buttons.js';

const FLOOR_HERE = 1;
const BLOCK_HERE = 1 << 1;
const PANEL_HERE = 1 << 3;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { block: 11, panel: 19, variant: 23 };
const PANEL_IN = 1;
const PANEL_OUT = 2;
const CELL_SIZE = 4;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function makePanelBlock(buttonDelay, defaultDelaySeconds) {
	const cells = new Uint32Array(LEVEL_CELLS * 2);
	for (let i = 0; i < cells.length; i++) cells[i] = FLOOR_HERE;
	const target = 37;
	const data = target * CELL_SIZE;
	cells[target] = (
		FLOOR_HERE |
		BLOCK_HERE |
		OPAQUE_BIT |
		PANEL_HERE |
		(3 << SHIFT.block) |
		(PANEL_OUT << SHIFT.panel)
	) >>> 0;
	const map = {
		tableOffsets: { mapData: 0, lifts: 0, doors: 0 },
		buttons: [{
			used: true,
			index: 0,
			actionIn: ACTION.BLOCK_OFF,
			actionOut: ACTION.NOTHING,
			dataIn: data,
			dataOut: 0,
			delay: buttonDelay,
		}],
	};
	return {
		cells,
		target,
		buttons: createButtonState(map, LEVEL_CELLS, { defaultDelaySeconds }),
	};
}

{
	const { cells, target, buttons } = makePanelBlock(10, 1);
	const result = activatePanel(buttons, cells, target);
	assert(result?.pressed, 'delayed panel was not pressed');
	assert(cells[target] & PANEL_HERE, 'delayed panel vanished before queued action');
	assert(((cells[target] >>> SHIFT.panel) & 0x3) === PANEL_IN, 'panel did not flip inward');
	stepButtons(buttons, cells, {}, 50);
	assert(!(cells[target] & BLOCK_HERE), 'queued block-off did not remove block');
	assert(!(cells[target] & PANEL_HERE), 'queued block-off left floating panel');
	assert(!(cells[target] & OPAQUE_BIT), 'queued block-off left opaque bit');
}

{
	const { cells, target, buttons } = makePanelBlock(0, 0);
	const result = activatePanel(buttons, cells, target);
	assert(result?.panelGone, 'immediate self-erasing button did not report missing panel');
	assert(!(cells[target] & BLOCK_HERE), 'immediate block-off did not remove block');
	assert(!(cells[target] & PANEL_HERE), 'immediate block-off re-added panel');
	assert(!(cells[target] & OPAQUE_BIT), 'immediate block-off left opaque bit');
}

console.log('button smoke: self-erasing panel block actions checked');
