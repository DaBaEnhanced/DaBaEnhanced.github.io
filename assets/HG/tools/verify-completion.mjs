import { COMPLETION, evaluateMissionCompletion } from '../src/completion.js';
import { WINDOW } from '../src/gadgets.js';

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

const live = () => ({ active: true, windowType: WINDOW.VIEW, dead: false });
const dead = () => ({ active: true, windowType: WINDOW.DEAD, dead: true });
const exit = () => ({ active: true, windowType: WINDOW.EXIT, inExit: true, dead: false });

{
	const r = evaluateMissionCompletion([exit(), dead(), live(), live()]);
	assert(!r.complete && r.resolved === 2 && r.dead === 1 && r.exited === 1,
		'campaign should wait until all four players are resolved');
}

{
	const r = evaluateMissionCompletion([exit(), dead(), exit(), dead()]);
	assert(r.complete && r.type === COMPLETION.CAMPAIGN_COMPLETE,
		'campaign should complete when all four players are dead or in exit');
	assert(r.dead === 2 && r.exited === 2 && r.winner === 0,
		'campaign resolved counts/winner mismatch');
}

{
	const r = evaluateMissionCompletion([dead(), dead(), dead(), dead()]);
	assert(r.complete && r.type === COMPLETION.DEATH, 'all-dead party should trigger death');
}

{
	const r = evaluateMissionCompletion([dead(), dead(), exit(), live()], {
		actionFlag: 1, atTrip1: 10, atTrip2: 10, locnPlayers: 0, numPlayers: 4,
	});
	assert(r.complete && r.type === COMPLETION.ACTION_COMPLETE,
		'action mode should complete when at least one resolved player exited');
}

{
	const r = evaluateMissionCompletion([dead(), exit(), exit(), exit()], {
		actionFlag: 1, atTrip1: 10, atTrip2: 10, locnPlayers: 1, numPlayers: 4,
	});
	assert(r.complete && r.type === COMPLETION.ACTION_FAILED,
		'one-player action should fail if anyone dies before all are resolved');
}

{
	const r = evaluateMissionCompletion([dead(), exit(), exit(), exit()], {
		actionFlag: 1, atTrip1: 10, atTrip2: 10, locnPlayers: 1, numPlayers: 3,
	});
	assert(r.complete && r.type === COMPLETION.ACTION_COMPLETE,
		'three-player one-player action allows one death');
}

{
	const r = evaluateMissionCompletion([live(), live(), live(), live()], {
		actionFlag: 1, atTrip1: 0, atTrip2: 0, locnPlayers: 0, numPlayers: 4,
	});
	assert(r.complete && r.type === COMPLETION.TIME_UP, 'action timers at zero should time out');
}

console.log('completion smoke: source check_exit cases covered');
