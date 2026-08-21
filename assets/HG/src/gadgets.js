// Mouse control: a port of the gadget tables and their hit test
// (Sources/ColdStartup.s:2457, 2761).
//
// The whole 160x105 player pane is carved into clickable rectangles -- there is
// no separate cursor mode. Clicking the upper middle of the 3D view walks
// forward, the left and right thirds turn, the lower corners sidestep, the
// middle band fires, and the strip along the top selects the store, VDU and
// stats windows. That is why the view is inset at (2,14): the border around it
// IS the control surface.
//
// Each entry is
//   dc.w topX, topY, bottomX, bottomY, spriteNum, action, rightAction
// in PANE-relative coordinates, and the action numbers are the same ones
// check_players_controls dispatches (Controls&Movement.s:4592).

export const ACTION = {
	NONE: 0, FORWARD: 1, BACKWARD: 2, TURN_LEFT: 3, TURN_RIGHT: 4,
	ACTIVATE: 5, PULL: 6,
	LEFT_WINDOW: 7, RIGHT_WINDOW: 8, VIEW: 9,
	STORE: 10, VDU: 11, STATS: 12,
	SIDESTEP_RIGHT: 13, SIDESTEP_LEFT: 14,
	PICK_UP: 15, SET_TEAM: 16, USE_ITEM: 17,
	RELOAD_ITEM: 18, SUMMON_INFO: 19, LOCK_TO_PLAYER: 20, LEAVE_INFO: 21,
	PICK_UP_INTO_INVEN: 22, DROP_ITEM: 23, DROP_FROM_INVEN: 24, THROW_G: 25,
	THROW_G4: 26, THROW_G3: 27, THROW_G2: 28, THROW_G1: 29,
};

export const WINDOW = {
	VIEW: 0, STORE: 1, VDU: 2, STATS: 3, DEAD: 5, INFO: 6, EXIT: 7,
};

const g = (x0, y0, x1, y1, sprite, action, right, name) =>
	({ x0, y0, x1, y1, sprite, action, right, name });

// win0_gadgets_no_aux -- the plain 3D view with nothing underfoot to grab.
// The `aux` variants add a pick-up gadget over the bottom-left corner; that is
// wired once inventory exists.
export const VIEW_GADGETS = [
	g(38, 14, 107, 41, 1, ACTION.FORWARD, ACTION.NONE, 'forward'),
	g(108, 14, 143, 75, 4, ACTION.TURN_RIGHT, ACTION.NONE, 'turn right'),
	g(2, 14, 37, 75, 3, ACTION.TURN_LEFT, ACTION.NONE, 'turn left'),
	g(108, 76, 143, 97, 13, ACTION.SIDESTEP_RIGHT, ACTION.NONE, 'sidestep right'),
	g(2, 76, 37, 97, 14, ACTION.SIDESTEP_LEFT, ACTION.NONE, 'sidestep left'),
	g(38, 42, 107, 76, 5, ACTION.ACTIVATE, ACTION.PULL, 'fire / pull'),
	g(38, 77, 107, 97, 2, ACTION.BACKWARD, ACTION.NONE, 'backward'),
	g(38, 0, 59, 9, 10, ACTION.STORE, ACTION.NONE, 'store'),
	g(60, 0, 79, 9, 10, ACTION.VDU, ACTION.NONE, 'vdu'),
	g(80, 0, 99, 9, 10, ACTION.STATS, ACTION.NONE, 'stats'),
	g(144, 10, 151, 19, 10, ACTION.SET_TEAM, ACTION.NONE, 'leader'),
];

export const VIEW_AUX_GADGETS = [
	g(4, 64, 35, 95, 14, ACTION.SIDESTEP_LEFT, ACTION.PICK_UP_INTO_INVEN, 'pick up'),
	...VIEW_GADGETS,
];

export const VIEW_GRENADE_GADGETS = [
	g(38, 14, 107, 41, 1, ACTION.FORWARD, ACTION.NONE, 'forward'),
	g(108, 14, 143, 75, 4, ACTION.TURN_RIGHT, ACTION.NONE, 'turn right'),
	g(2, 14, 37, 75, 3, ACTION.TURN_LEFT, ACTION.NONE, 'turn left'),
	g(108, 76, 143, 97, 13, ACTION.SIDESTEP_RIGHT, ACTION.NONE, 'sidestep right'),
	g(2, 76, 37, 97, 14, ACTION.SIDESTEP_LEFT, ACTION.NONE, 'sidestep left'),
	g(38, 41, 107, 50, 18, ACTION.THROW_G4, ACTION.NONE, 'throw far'),
	g(38, 51, 107, 59, 17, ACTION.THROW_G3, ACTION.NONE, 'throw high'),
	g(38, 60, 107, 68, 16, ACTION.THROW_G2, ACTION.NONE, 'throw middle'),
	g(38, 69, 107, 77, 15, ACTION.THROW_G1, ACTION.NONE, 'throw low'),
	g(38, 77, 107, 97, 2, ACTION.BACKWARD, ACTION.NONE, 'backward'),
	g(38, 0, 59, 9, 10, ACTION.STORE, ACTION.NONE, 'store'),
	g(60, 0, 79, 9, 10, ACTION.VDU, ACTION.NONE, 'vdu'),
	g(80, 0, 99, 9, 10, ACTION.STATS, ACTION.NONE, 'stats'),
	g(144, 10, 151, 19, 10, ACTION.SET_TEAM, ACTION.NONE, 'leader'),
];

export const VIEW_AUX_GRENADE_GADGETS = [
	g(4, 64, 35, 95, 14, ACTION.SIDESTEP_LEFT, ACTION.PICK_UP_INTO_INVEN, 'pick up'),
	...VIEW_GRENADE_GADGETS,
];

export const STORE_GADGETS = [
	g(0, 17, 65, 43, 1, ACTION.FORWARD, ACTION.NONE, 'store up'),
	g(0, 67, 65, 93, 2, ACTION.BACKWARD, ACTION.NONE, 'store down'),
	g(66, 33, 83, 58, 6, ACTION.PICK_UP, ACTION.NONE, 'pick up'),
	g(66, 59, 83, 84, 7, ACTION.DROP_ITEM, ACTION.NONE, 'drop'),
	g(0, 44, 65, 66, 13, ACTION.TURN_RIGHT, ACTION.NONE, 'use'),
	g(84, 36, 149, 74, 14, ACTION.TURN_LEFT, ACTION.USE_ITEM, 'unuse / use item'),
	g(66, 10, 83, 32, 9, ACTION.SUMMON_INFO, ACTION.NONE, 'info'),
	g(0, 0, 31, 9, 10, ACTION.VIEW, ACTION.NONE, 'view'),
	g(58, 0, 79, 9, 10, ACTION.VDU, ACTION.NONE, 'vdu'),
	g(80, 0, 99, 9, 10, ACTION.STATS, ACTION.NONE, 'stats'),
	g(146, 10, 153, 19, 10, ACTION.SET_TEAM, ACTION.NONE, 'leader'),
];

export const VDU_GADGETS = [
	g(0, 0, 39, 9, 10, ACTION.VIEW, ACTION.NONE, 'view'),
	g(40, 0, 51, 9, 10, ACTION.STORE, ACTION.NONE, 'store'),
	g(78, 0, 99, 9, 10, ACTION.STATS, ACTION.NONE, 'stats'),
	g(55, 15, 98, 55, 11, ACTION.FORWARD, ACTION.LOCK_TO_PLAYER, 'vdu up'),
	g(99, 15, 141, 96, 13, ACTION.TURN_RIGHT, ACTION.LOCK_TO_PLAYER, 'vdu right'),
	g(12, 15, 54, 96, 14, ACTION.TURN_LEFT, ACTION.LOCK_TO_PLAYER, 'vdu left'),
	g(55, 56, 98, 96, 12, ACTION.BACKWARD, ACTION.LOCK_TO_PLAYER, 'vdu down'),
	g(142, 10, 149, 19, 10, ACTION.SET_TEAM, ACTION.NONE, 'leader'),
];

export const STATS_GADGETS = [
	g(0, 0, 39, 11, 10, ACTION.VIEW, ACTION.NONE, 'view'),
	g(40, 0, 59, 11, 10, ACTION.STORE, ACTION.NONE, 'store'),
	g(60, 0, 71, 11, 10, ACTION.VDU, ACTION.NONE, 'vdu'),
	g(146, 10, 153, 19, 10, ACTION.SET_TEAM, ACTION.NONE, 'leader'),
];

export const DEAD_GADGETS = [
	g(0, 0, 153, 99, 8, ACTION.LEAVE_INFO, ACTION.NONE, 'wake'),
];

export const EXIT_GADGETS = [
	g(0, 0, 153, 99, 8, ACTION.NONE, ACTION.NONE, 'exit'),
];

export function tableForPlayer(player) {
	switch (player?.windowType ?? WINDOW.VIEW) {
		case WINDOW.STORE:
		case WINDOW.INFO:
			return STORE_GADGETS;
		case WINDOW.VDU:
			return VDU_GADGETS;
		case WINDOW.STATS:
			return STATS_GADGETS;
		case WINDOW.DEAD:
			return DEAD_GADGETS;
		case WINDOW.EXIT:
			return EXIT_GADGETS;
		default:
			if (player?.usingGrenade && player?.hasAux) return VIEW_AUX_GRENADE_GADGETS;
			if (player?.usingGrenade) return VIEW_GRENADE_GADGETS;
			if (player?.hasAux) return VIEW_AUX_GADGETS;
			return VIEW_GADGETS;
	}
}

/**
 * Which gadget, if any, a pane-relative point lands on. The original scans the
 * table in order and takes the first hit, so overlapping entries resolve by
 * table position -- keep the array order.
 */
export function hitGadget(px, py, table = VIEW_GADGETS) {
	for (const g of table) {
		if (px >= g.x0 && px <= g.x1 && py >= g.y0 && py <= g.y1) return g;
	}
	return null;
}

/**
 * Turn a canvas click into {pane, gadget, action}.
 *
 * @param sx,sy   position in 320x212 SCREEN pixels (the caller undoes the
 *                integer upscale, which is the only part that knows about CSS).
 * @param origins PANE_ORIGINS
 * @param right   true for a right-click, which takes the gadget's alternate.
 */
export function pickGadget(sx, sy, origins, paneW, paneH, right = false, players = null) {
	for (let i = 0; i < origins.length; i++) {
		const [ox, oy] = origins[i];
		if (sx < ox || sy < oy || sx >= ox + paneW || sy >= oy + paneH) continue;
		const player = players ? players[i] : null;
		const table = player && !player.active ? [] : tableForPlayer(player);
		const g = hitGadget(sx - ox, sy - oy, table);
		if (!g) return { pane: i, gadget: null, action: ACTION.NONE };
		const action = right ? (g.right ?? ACTION.NONE) : g.action;
		return { pane: i, gadget: g, action };
	}
	return null;
}
