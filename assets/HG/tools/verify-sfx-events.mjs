// Sound-event and corpse behaviour that the parity harness cannot see, because
// none of it changes a rendered frame in the reference views.
//
//   doors    Main.s:2342-2402 -- sample 5 when a door starts moving in either
//            direction, sample 4 when it reaches fully open or fully closed.
//   falling  Main.s:4295 -- the landing sound fires on the edge, once per fall,
//            not on every frame spent standing on a floor.
//   corpses  A cell has one aux slot. If a floor item holds it when a monster
//            dies, the body is remembered and laid down once the item is taken.
import { createDoorState, moveDoors, TRIG } from '../src/doors.js';
import { playersFall, createFallState } from '../src/falling.js';
import { LEVEL_CELLS, MAP_WIDTH } from '../src/view.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, AUX_HERE = 1 << 5;
const SHIFT_BLOCK = 11, DOOR_FRONT = 20;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

// --- doors ----------------------------------------------------------------
{
  const cells = new Uint32Array(LEVEL_CELLS * 20);
  const i = LEVEL_CELLS * 5 + 11 * MAP_WIDTH + 11;
  // hgmap reads door_type as a full 32-bit cell value, so it carries BLOCK_HERE.
  const type = (BLOCK_HERE | (DOOR_FRONT << SHIFT_BLOCK)) >>> 0;
  cells[i] = (BLOCK_HERE | type) >>> 0;
  const st = createDoorState([{ posn: i << 2, type, delay: -1, key: 0, buttonOnly: 0, direction: 0 }]);
  ok(st.doors.length === 1, 'door state built');
  let moving = 0, arrived = 0;
  const hooks = { onDoorMoving: () => moving++, onDoorArrived: () => arrived++ };

  st.doors[0].trig = TRIG.OPEN;
  for (let t = 0; t < 400; t++) moveDoors(st, cells, 1, hooks);
  ok(moving === 1, `open: travel sound once (got ${moving})`);
  ok(arrived === 1, `open: arrival sound once (got ${arrived})`);
  ok(!(cells[i] & BLOCK_HERE), 'door ended fully open');

  const m1 = moving, a1 = arrived;
  st.doors[0].trig = TRIG.CLOSE;
  for (let t = 0; t < 400; t++) moveDoors(st, cells, 1, hooks);
  ok(moving === m1 + 1, `close: travel sound once more (got ${moving - m1})`);
  ok(arrived === a1 + 1, `close: arrival sound once more (got ${arrived - a1})`);
  ok(!!(cells[i] & BLOCK_HERE), 'door ended fully closed');
}

// --- falling --------------------------------------------------------------
{
  const cells = new Uint32Array(LEVEL_CELLS * 20);
  const x = 11, y = 11;
  cells[LEVEL_CELLS * 3 + y * MAP_WIDTH + x] = FLOOR_HERE;
  const p = { x, y, floor: 6, stats: {}, fall: createFallState(), index: 0 };
  let lands = 0;
  const hooks = { onLand: () => lands++ };
  for (let t = 0; t < 60; t++) playersFall(cells, [p], hooks);
  ok(p.floor === 3, `fell to the floor (got ${p.floor})`);
  ok(lands === 1, `landing sound exactly once (got ${lands})`);
  for (let t = 0; t < 30; t++) playersFall(cells, [p], hooks);
  ok(lands === 1, `no repeat while standing (got ${lands})`);
}

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

// --- pending corpse: item blocks the aux slot, corpse lands on pickup ------
{
  const { createMonsterState, damageMonsterFitness, placePendingCorpse } =
    await import('../src/monsters.js');
  const cells = new Uint32Array(LEVEL_CELLS * 20);
  const idx = LEVEL_CELLS * 4 + 11 * MAP_WIDTH + 11;
  cells[idx] = (FLOOR_HERE | AUX_HERE | (7 << 28)) >>> 0;    // a floor item here
  // createMonsterState wants a parsed map plus defs; the monster itself only
  // needs enough shape for damage + kill.
  const state = createMonsterState({ locn: {}, monsters: [] }, []);
  const m = { active: true, cell: idx, fitness: 10, white: false, direction: 0, def: {}, slot: 1 };
  state.monsters.push(m);
  {
    damageMonsterFitness(state, cells, m, 1 << 20);           // overkill
    ok(!m.active, 'monster died');
    ok(state.pendingCorpses?.has(idx) === true, 'corpse remembered while item present');
    ok(placePendingCorpse(state, cells, idx) === false, 'not placed while item still there');
    cells[idx] = (cells[idx] & ~AUX_HERE & ~(0xf << 28)) >>> 0;   // item picked up
    ok(placePendingCorpse(state, cells, idx) === true, 'corpse placed after pickup');
    ok(!!(cells[idx] & AUX_HERE), 'aux now holds the corpse');
    ok(state.pendingCorpses.has(idx) === false, 'pending entry cleared');
    ok(placePendingCorpse(state, cells, idx) === false, 'not placed twice');
  }
}
console.log(`total: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

// --- party carry: inventory and stats survive a map change ----------------
{
  const { snapshotGame, applyGameSnapshot } = await import('../src/save.js');
  // Stand-in for the shape main.js captures/restores.
  const players = [
    { inventory: { using: { num: 42, ammo: 7 }, store: [{ num: 9 }], pos: 0 },
      stats: { fitness: 12345, experience: 800, physique: 150 }, dead: false },
    { inventory: { using: { num: 0 }, store: [], pos: 0 },
      stats: { fitness: 65535, experience: 0, physique: 100 }, dead: false },
  ];
  const carry = players.map((p) => ({
    inventory: structuredClone(p.inventory),
    stats: { ...p.stats },
    dead: !!p.dead,
  }));
  ok(carry[0].inventory.using.num === 42, 'carry keeps the held item');
  ok(carry[0].stats.experience === 800, 'carry keeps earned experience');
  // Mutating the live player must not reach the captured copy.
  players[0].inventory.using.ammo = 0;
  players[0].stats.experience = 0;
  ok(carry[0].inventory.using.ammo === 7, 'carry is a deep copy (inventory)');
  ok(carry[0].stats.experience === 800, 'carry is a deep copy (stats)');
  // And it round-trips through a between-maps save.
  const g = { shell: { party: [0,1,2,3], completed: [], unlocked: [], here: 1 }, partyCarry: carry };
  const snap = snapshotGame(g);
  ok(snap.kind === 'campaign', 'between-maps save is campaign kind');
  ok(snap.partyCarry?.[0]?.inventory?.using?.num === 42, 'carry survives the save');
  ok(snap.partyCarry?.[0]?.stats?.experience === 800, 'stats survive the save');
}
console.log(`with carry: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
