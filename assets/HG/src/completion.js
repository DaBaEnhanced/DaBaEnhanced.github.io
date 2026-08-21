// End-of-level checks from Main.s:check_exit.
//
// The source counts each player as "resolved" when they are either dead or in
// window type 7 (exit). Campaign mode completes when all four are resolved.

export const COMPLETION = {
	NONE: 'none',
	DEATH: 'death',
	CAMPAIGN_COMPLETE: 'campaignComplete',
	ACTION_COMPLETE: 'actionComplete',
	ACTION_FAILED: 'actionFailed',
	TIME_UP: 'timeUp',
};

const EXIT_WINDOW = 7;

function resolvedState(p) {
	if (!p || p.active === false || p.dead || p.deadFlag2) return 'dead';
	if (p.inExit || ((p.windowType | 0) === EXIT_WINDOW)) return 'exit';
	return 'live';
}

export function evaluateMissionCompletion(players, opts = {}) {
	const total = opts.totalPlayers ?? 4;
	let resolved = 0, dead = 0, exited = 0, winner = -1;
	for (let i = 0; i < total; i++) {
		const state = resolvedState(players?.[i]);
		if (state === 'dead') {
			dead++;
			resolved++;
		} else if (state === 'exit') {
			if (winner < 0) winner = i;
			exited++;
			resolved++;
		}
	}

	const base = { resolved, dead, exited, winner };
	if (dead === total) return { ...base, complete: true, type: COMPLETION.DEATH };

	if (opts.actionFlag) {
		if ((opts.atTrip1 | 0) === 0 && (opts.atTrip2 | 0) === 0) {
			return { ...base, complete: true, type: COMPLETION.TIME_UP };
		}
		if ((opts.locnPlayers | 0) === 1) {
			if (resolved !== total) return { ...base, complete: false, type: COMPLETION.NONE };
			const allowedDeaths = (opts.numPlayers | 0) === 3 ? 1 : 0;
			return dead > allowedDeaths
				? { ...base, complete: true, type: COMPLETION.ACTION_FAILED }
				: { ...base, complete: true, type: COMPLETION.ACTION_COMPLETE };
		}
		if (dead < resolved) {
			return { ...base, complete: true, type: COMPLETION.ACTION_COMPLETE };
		}
		return { ...base, complete: false, type: COMPLETION.NONE };
	}

	if (resolved === total) {
		return { ...base, complete: true, type: COMPLETION.CAMPAIGN_COMPLETE };
	}
	return { ...base, complete: false, type: COMPLETION.NONE };
}
