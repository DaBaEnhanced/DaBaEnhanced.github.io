import {
  distanceToSegment, edgeEnd, edgeOwners, levelBounds, validateLevel,
} from './geometry.js?v=source-fidelity-7';
import { ObjectTextures, PanelTexture, TextureBanks } from './textures.js?v=source-fidelity-21';
import { VectorObjects } from './vectorObjects.js?v=source-fidelity-2';
import { FontTextures } from './fonts.js';
import { advanceCampaign, FrontendController, FrontendRenderer } from './frontend.js?v=source-fidelity-6';
import { EndingSequence } from './ending.js';
import { AudioEngine } from './audio.js?v=source-fidelity-17';
import { GAMEPAD_BUTTONS, loadCampaign, readGamepad, saveCampaign } from './controls.js?v=source-fidelity-2';
import { SourceViewRenderer } from './renderer3d.js?v=source-fidelity-125';
import { shouldGrabPointer, TouchControls } from './touch.js?v=browser-controls-2';

const canvas = document.querySelector('#map');
const context = canvas.getContext('2d');
const levelSelect = document.querySelector('#level');
const errorBox = document.querySelector('#error');
const toggles = {
  portals: document.querySelector('#portals'),
  grid: document.querySelector('#grid'),
  starts: document.querySelector('#starts'),
};
const cheatButtons = {
  invulnerability: document.querySelector('#cheat-invulnerability'),
  infiniteBullets: document.querySelector('#cheat-infinite-bullets'),
};
const PLAY_MODE = document.body?.dataset?.mode === 'play';

let level = null;
let owners = [];
let view = { x: 0, z: 0, scale: 1 };
let selectedZone = null;
let dragging = null;
let renderer = null;
const frontend = new FrontendController();
let frontendRenderer = null;
let ending = null;
let audio = null;
let viewMode = 'first-person';
let paused = false;
let dead = false;
let campaignTransitionPending = false;
const browserCheats = { invulnerability: false, infiniteBullets: false };
const keys = new Set();
let operateQueued = false;
let touchFireQueued = false;
let lookMoved = false;
let presentationDirty = false;
let previousGamepadButtons = new Set();
const touchPointers = new Map();
const GUN_KEYS = new Map([
  ['Digit1', 0], ['Digit2', 7], ['Digit3', 1], ['Digit4', 4], ['Digit5', 2],
]);

function viewHelp() {
  return viewMode === 'map'
    ? 'Wheel to zoom · drag to pan · click a wall to inspect its zone'
    : 'WASD move · mouse look (vertical in Enhanced) · Shift run · C duck · L look back · Space use · Ctrl/click fire';
}

const screen = (x, z) => ({
  x: (x - view.x) * view.scale + canvas.clientWidth / 2,
  y: (z - view.z) * view.scale + canvas.clientHeight / 2,
});

const world = (x, y) => ({
  x: (x - canvas.clientWidth / 2) / view.scale + view.x,
  z: (y - canvas.clientHeight / 2) / view.scale + view.z,
});

function fitLevel() {
  if (!level) return;
  if (viewMode === 'first-person') {
    renderer?.reset(level);
    draw();
    return;
  }
  const bounds = levelBounds(level);
  const padding = 52;
  view.x = (bounds.minX + bounds.maxX) / 2;
  view.z = (bounds.minZ + bounds.maxZ) / 2;
  view.scale = Math.max(.02, Math.min(
    (canvas.clientWidth - padding * 2) / Math.max(1, bounds.width),
    (canvas.clientHeight - padding * 2) / Math.max(1, bounds.height),
  ));
  draw();
}

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function drawGrid() {
  if (!toggles.grid.checked) return;
  const spacing = 256;
  const topLeft = world(0, 0);
  const bottomRight = world(canvas.clientWidth, canvas.clientHeight);
  context.beginPath();
  for (let x = Math.floor(topLeft.x / spacing) * spacing; x <= bottomRight.x; x += spacing) {
    const a = screen(x, topLeft.z), b = screen(x, bottomRight.z);
    context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
  }
  for (let z = Math.floor(topLeft.z / spacing) * spacing; z <= bottomRight.z; z += spacing) {
    const a = screen(topLeft.x, z), b = screen(bottomRight.x, z);
    context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
  }
  context.strokeStyle = 'rgba(87, 116, 114, .12)';
  context.lineWidth = 1;
  context.stroke();
}

function strokeEdges(edges, colour, width) {
  context.beginPath();
  for (const edge of edges) {
    const a = screen(edge.x, edge.z);
    const end = edgeEnd(edge);
    const b = screen(end.x, end.z);
    context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
  }
  context.strokeStyle = colour;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.stroke();
}

function drawPlayer(player, colour, label) {
  const p = screen(player.x, player.z);
  context.beginPath();
  context.arc(p.x, p.y, 6, 0, Math.PI * 2);
  context.fillStyle = colour;
  context.fill();
  context.fillStyle = colour;
  context.font = '700 11px ui-monospace, monospace';
  context.fillText(label, p.x + 9, p.y + 4);
}

function clearVisibleCanvas() {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  context.fillStyle = '#080c0d';
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function reportRuntimeError(error) {
  errorBox.dataset.runtimeError = 'true';
  errorBox.textContent = `Runtime frame error (controls remain active):\n${error.stack || error.message}`;
}

function clearRuntimeError() {
  if (errorBox.dataset.runtimeError !== 'true') return;
  delete errorBox.dataset.runtimeError;
  errorBox.textContent = '';
}

function draw() {
  if (ending?.active) {
    ending.draw(context, canvas.clientWidth, canvas.clientHeight);
    return;
  }
  if (frontend.active && frontendRenderer) {
    frontendRenderer.draw(frontend, context, canvas.clientWidth, canvas.clientHeight);
    return;
  }
  if (!level) {
    clearVisibleCanvas();
    return;
  }
  if (viewMode === 'first-person') {
    if (renderer) {
      // SourceViewRenderer builds the complete frame offscreen. Do not erase
      // the last successfully presented frame before that work completes: a
      // diagnostic fixed-point exception used to leave the visible canvas
      // black and then escape requestAnimationFrame, freezing all controls.
      try {
        renderer.render(level, context, canvas.clientWidth, canvas.clientHeight, paused);
        clearRuntimeError();
      } catch (error) {
        reportRuntimeError(error);
      }
    }
    return;
  }
  clearVisibleCanvas();
  drawGrid();

  const solids = level.edges.filter(edge => edge.joinZone < 0);
  const portals = level.edges.filter(edge => edge.joinZone >= 0);
  strokeEdges(solids, 'rgba(233, 230, 220, .62)', 1.25);
  if (toggles.portals.checked) strokeEdges(portals, 'rgba(59, 218, 213, .7)', 1.25);

  if (selectedZone !== null) {
    const selected = level.zones[selectedZone].edgeIds.map(id => level.edges[id]);
    strokeEdges(selected, '#d8e230', 3);
  }
  if (toggles.starts.checked) {
    drawPlayer(level.player1, '#e64739', 'P1');
    drawPlayer(level.player2, '#d8e230', 'P2');
  }
}

function inspect(zoneId, edge) {
  selectedZone = zoneId;
  const zone = level.zones[zoneId];
  document.querySelector('#selection-title').textContent = `Zone ${zoneId}`;
  const values = [
    ['Selected edge', edge.id],
    ['Joins zone', edge.joinZone < 0 ? 'solid' : edge.joinZone],
    ['Campaign exit', zoneId === level.endZone ? 'yes' : 'no'],
    ['Floor', zone.floor],
    ['Roof', zone.roof],
    ['Brightness', zone.brightness],
    ['Edges', zone.edgeIds.length],
    ['Visible points', zone.pointIds.length],
  ];
  document.querySelector('#selection-data').innerHTML = values
    .map(([name, value]) => `<dt>${name}</dt><dd>${value}</dd>`).join('');
  draw();
}

function selectNearest(event) {
  const rect = canvas.getBoundingClientRect();
  const point = world(event.clientX - rect.left, event.clientY - rect.top);
  let best = { distance: 10 / view.scale, edge: null };
  for (const edge of level.edges) {
    const distance = distanceToSegment(point, edge, edgeEnd(edge));
    if (distance < best.distance) best = { distance, edge };
  }
  if (!best.edge) return;
  const candidates = owners[best.edge.id];
  const zoneId = candidates[0] ?? (best.edge.joinZone >= 0 ? best.edge.joinZone : null);
  if (zoneId !== null) inspect(zoneId, best.edge);
}

async function loadLevel(id) {
  try {
    delete errorBox.dataset.runtimeError;
    errorBox.textContent = '';
    const response = await fetch(`assets/levels/level_${id.toLowerCase()}.json?v=source-fidelity-8`);
    if (!response.ok) throw new Error(`level request failed: HTTP ${response.status}`);
    level = await response.json();
    validateLevel(level);
    owners = edgeOwners(level);
    renderer?.reset(level);
    selectedZone = null;
    document.querySelector('#selection-title').textContent = 'Select a wall';
    document.querySelector('#selection-data').replaceChildren();
    document.querySelector('#zones').textContent = level.zones.length.toLocaleString();
    document.querySelector('#edges').textContent = level.edges.length.toLocaleString();
    document.querySelector('#points').textContent = level.points.length.toLocaleString();
    const url = new URL(location.href);
    url.searchParams.set('level', id);
    history.replaceState(null, '', url);
    fitLevel();
    return true;
  } catch (error) {
    errorBox.textContent = `${error.stack || error.message}\nServe the web directory over HTTP; file:// cannot load the level manifests.`;
    return false;
  }
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image request failed: ${source}`));
    image.src = source;
  });
}

function currentStats() {
  const state = renderer?.world?.playerState;
  return state ? {
    level: Math.max(0, levelSelect.selectedIndex),
    energy: state.energy,
    guns: [...state.guns],
    ammo: [...state.ammo],
  } : null;
}

function applyPasswordStats(stats) {
  const state = renderer?.world?.playerState;
  if (!state) return;
  state.energy = stats.energy;
  state.guns = [...stats.guns];
  state.ammo = [...stats.ammo];
  state.selectedGun = 0;
  state.weaponFrame = 0;
  state.shotCooldown = 0;
  state.fireHeld = false;
}

function cycleGun(direction) {
  const state = renderer?.world?.playerState;
  if (!state) return false;
  const guns = [...GUN_KEYS.values()];
  let index = guns.indexOf(state.selectedGun);
  for (let tries = 0; tries < guns.length; tries++) {
    index = (index + direction + guns.length) % guns.length;
    if (renderer.selectGun(guns[index])) return true;
  }
  return false;
}

function setBrowserCheat(name, enabled) {
  browserCheats[name] = Boolean(enabled);
  renderer?.setBrowserCheats(browserCheats);
  const button = cheatButtons[name];
  button?.setAttribute('aria-pressed', String(browserCheats[name]));
  if (button) {
    const label = PLAY_MODE
      ? (name === 'invulnerability' ? 'God' : 'Ammo')
      : (name === 'invulnerability' ? 'Invulnerability' : 'Infinite bullets');
    button.textContent = `${label}: ${browserCheats[name] ? 'on' : 'off'}`;
  }
  draw();
}

function setPaused(next = !paused) {
  if (viewMode !== 'first-person' || frontend.active || ending?.active || dead) return;
  paused = next;
  keys.clear();
  document.querySelector('#map-help').textContent = paused
    ? 'Paused - forwards cycles SFX QUALITY - backwards cycles FLOOR DETAIL - P resumes'
    : viewHelp();
  draw();
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      try { await globalThis.screen?.orientation?.lock?.('landscape'); } catch { /* desktop */ }
    }
  } catch (error) {
    errorBox.textContent = `Fullscreen unavailable: ${error.message}`;
  }
}

// play.html calls this from its required start gesture so Web Audio receives a
// real browser activation without forwarding that gesture into retail input.
export function unlockAudio() {
  return audio?.unlock() ?? Promise.resolve(false);
}

async function loadSavedCampaign() {
  const stats = loadCampaign(browserStorage());
  if (!stats) {
    errorBox.textContent = 'No valid saved retail password is available in this browser.';
    return;
  }
  errorBox.textContent = '';
  levelSelect.value = String.fromCharCode(65 + stats.level);
  await loadLevel(levelSelect.value);
  applyPasswordStats(stats);
  frontend.setStats(stats);
  draw();
}

async function handleFrontendAction(action) {
  if (!action) return;
  if (action.type === 'display-pixels') {
    renderer?.setSourcePixels(action.sourcePixels);
    draw();
    return;
  }
  if (action.type === 'display-mode') {
    renderer?.setDisplayMode(action.displayMode);
    draw();
    return;
  }
  if (action.type === 'crt-filter') {
    document.body.classList.toggle('crt-filter', action.crtFilter);
    draw();
    return;
  }
  if (action.type === 'resume') {
    frontend.close();
    document.body.classList.remove('presentation');
    document.querySelector('#map-help').textContent = viewHelp();
    draw();
    return;
  }
  if (action.type === 'password') {
    levelSelect.value = String.fromCharCode(65 + action.stats.level);
    draw();
    return;
  }
  if (action.type === 'play') {
    if (campaignTransitionPending) return;
    campaignTransitionPending = true;
    try {
      // Browser-only loading is asynchronous. Keep the front end active until
      // the replacement world exists: otherwise animate() can revisit the old
      // world's latched `completed` byte and apply `wevewon`'s single MAXLEVEL
      // increment a second time. The retail transition itself is synchronous
      // (newtwo.s:wevewon lines 4632-4638, then ControlLoop.s GETSTATS).
      levelSelect.value = String.fromCharCode(65 + action.stats.level);
      if (!await loadLevel(levelSelect.value)) return;
      applyPasswordStats(action.stats);
      frontend.close();
      document.body.classList.remove('presentation');
      document.querySelector('#map-help').textContent = viewHelp();
      draw();
    } finally {
      campaignTransitionPending = false;
    }
  }
}

function openFrontend(reset = false) {
  keys.clear();
  paused = false;
  dead = false;
  ending?.stop();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  document.body.classList.add('presentation');
  if (reset) frontend.resetStats();
  frontend.open(reset ? null : currentStats());
  document.querySelector('#map-help').textContent =
    'Retail menu · arrows select · Enter/Space confirm · Escape resumes';
  draw();
}

function finishLevel() {
  const transition = advanceCampaign(currentStats());
  keys.clear();
  operateQueued = false;
  paused = false;
  dead = false;
  frontend.close();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  document.body.classList.add('presentation');
  if (transition.type === 'ending') {
    ending.start();
    document.querySelector('#map-help').textContent =
      'Retail ending · click/Space skips the opening hold · Escape returns to title';
  } else {
    ending.stop();
    frontend.open();
    frontend.setStats(transition.stats);
    levelSelect.value = String.fromCharCode(65 + transition.stats.level);
    document.querySelector('#map-help').textContent =
      'Level complete · next retail level selected · Enter/Space continues';
  }
  draw();
}

async function start() {
  const [response, textures, objects, panel, vectors, fonts, titleImage, loadedAudio] = await Promise.all([
    fetch('assets/levels/index.json?v=source-fidelity-8'),
    TextureBanks.load(),
    ObjectTextures.load(),
    PanelTexture.load(),
    VectorObjects.load(),
    FontTextures.load(),
    loadImage('assets/title.png'),
    AudioEngine.load(),
  ]);
  if (!response.ok) throw new Error(`level index request failed: HTTP ${response.status}`);
  renderer = new SourceViewRenderer(textures, objects, panel, vectors, fonts);
  renderer.setBrowserCheats(browserCheats);
  frontendRenderer = new FrontendRenderer(fonts, titleImage);
  frontend.setDisplayMode(renderer.displayMode);
  frontend.setCrtFilter(document.body.classList.contains('crt-filter'));
  ending = await EndingSequence.load(fonts);
  audio = loadedAudio;
  const index = await response.json();
  document.querySelector('#level-count').textContent = index.length;
  for (const item of index) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `Level ${item.id} · ${item.zones} zones`;
    levelSelect.append(option);
  }
  const requested = new URLSearchParams(location.search).get('level')?.toUpperCase();
  levelSelect.value = index.some(item => item.id === requested) ? requested : 'A';
  await loadLevel(levelSelect.value);
  const saved = loadCampaign(browserStorage());
  if (saved) frontend.setStats(saved);
  const parameters = new URLSearchParams(location.search);
  const requestedView = parameters.get('view');
  if (requestedView === 'map') document.querySelector('[data-view="map"]').click();
  if (parameters.get('ending') === '1' || parameters.get('ending') === 'scroll') {
    document.querySelector('#ending').click();
    if (parameters.get('ending') === 'scroll') ending.skipIntro();
  }
  else if (parameters.get('menu') === '1' || PLAY_MODE) openFrontend(PLAY_MODE);
}

levelSelect.addEventListener('change', () => loadLevel(levelSelect.value));
document.querySelector('#fit').addEventListener('click', fitLevel);
document.querySelector('#menu').addEventListener('click', () => openFrontend());
document.querySelector('#ending').addEventListener('click', () => {
  keys.clear();
  frontend.close();
  paused = false;
  dead = false;
  ending.start();
  document.body.classList.add('presentation');
  document.querySelector('#map-help').textContent =
    'Retail ending · click/Space skips the opening hold · Escape returns to title';
  draw();
});
document.querySelector('#save').addEventListener('click', () => {
  const password = saveCampaign(browserStorage(), currentStats());
  errorBox.textContent = password
    ? `Saved retail password: ${password}` : 'Unable to save in this browser.';
});
document.querySelector('#load').addEventListener('click', () => { void loadSavedCampaign(); });
document.querySelector('#fullscreen').addEventListener('click', () => { void toggleFullscreen(); });
document.querySelector('#play-pause')?.addEventListener('click', () => setPaused());
document.querySelector('#play-duck')?.addEventListener('click', () => renderer?.toggleCrouch());
document.querySelector('#play-weapon')?.addEventListener('click', () => {
  if (cycleGun(1)) draw();
});
for (const [name, button] of Object.entries(cheatButtons)) {
  button.addEventListener('click', () => setBrowserCheat(name, !browserCheats[name]));
}
Object.values(toggles).forEach(toggle => toggle.addEventListener('change', draw));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  viewMode = button.dataset.view;
  document.body.classList.toggle('view-3d', viewMode === 'first-person');
  document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#map-help').textContent = viewHelp();
  document.querySelector('#fit').textContent = viewMode === 'map' ? 'Fit level' : 'Reset camera';
  const url = new URL(location.href);
  url.searchParams.set('view', viewMode === 'map' ? 'map' : '3d');
  history.replaceState(null, '', url);
  fitLevel();
}));

function handleTouchConfirm() {
  if (ending?.active) {
    ending.skipIntro();
    draw();
    return true;
  }
  if (dead) {
    openFrontend(true);
    return true;
  }
  if (frontend.active) {
    void handleFrontendAction(frontend.key('Enter'));
    draw();
    return true;
  }
  return false;
}

// play.html uses the same browser-only two-stick delivery model as the sibling
// Breathless port. All values feed the existing PLR1 control adapter; source
// acceleration, collision, firing and operate routines remain unchanged.
const touch = PLAY_MODE ? new TouchControls(canvas, {
  onWake: () => { void audio?.unlock(); },
  onConfirm: handleTouchConfirm,
  onFire: () => { touchFireQueued = true; },
  onUse: () => { operateQueued = true; },
  onLook: (horizontal, vertical = 0) => {
    if (viewMode !== 'first-person' || paused || frontend.active || ending?.active || dead) return;
    if (horizontal) renderer?.turn(horizontal * .008);
    const pitched = vertical ? renderer?.lookVertical(vertical * .008) : false;
    lookMoved ||= Boolean(horizontal) || pitched;
  },
}, canvas.closest('.play-screen') || canvas) : {
  enabled: false,
  direction: () => ({
    forwardPressed: false, backwardPressed: false, strafeLeft: false, strafeRight: false,
  }),
  lookRate() {}, updatePads() {}, release() {},
};

canvas.addEventListener('wheel', event => {
  if (viewMode !== 'map') return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const before = world(event.clientX - rect.left, event.clientY - rect.top);
  view.scale = Math.max(.015, Math.min(8, view.scale * Math.exp(-event.deltaY * .0012)));
  const after = world(event.clientX - rect.left, event.clientY - rect.top);
  view.x += before.x - after.x;
  view.z += before.z - after.z;
  draw();
}, { passive: false });

canvas.addEventListener('pointerdown', event => {
  void audio?.unlock();
  if (touch.enabled && (event.pointerType === 'touch' || event.pointerType === 'pen')) return;
  if (ending?.active) {
    ending.skipIntro();
    draw();
    return;
  }
  if (frontend.active) return;
  if (viewMode === 'first-person') {
    if (shouldGrabPointer({
      pointerType: event.pointerType,
      playing: !paused && !dead,
      locked: document.pointerLockElement === canvas,
      touchEnabled: touch.enabled,
    })) {
      canvas.requestPointerLock?.();
      event.preventDefault();
      return;
    }
    if (event.button === 0) keys.add('Mouse0');
    if (event.button === 2) operateQueued = true;
    return;
  }
  dragging = {
    startX: event.clientX, startY: event.clientY,
    x: event.clientX, y: event.clientY, moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', event => {
  if (document.pointerLockElement === canvas && viewMode === 'first-person') return;
  if (frontend.active) return;
  if (!dragging) return;
  let dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
  if (!dragging.moved) {
    const totalX = event.clientX - dragging.startX;
    const totalY = event.clientY - dragging.startY;
    // Click is the browser fire alias. Do not feed sub-threshold pointer
    // jitter into the camera before that same gesture has become an explicit
    // drag; the old path accumulated a turn on repeated fire clicks. This is
    // adapter state only--PLR1_keyboard_control remains the movement oracle.
    if (Math.abs(totalX) + Math.abs(totalY) <= 2) return;
    dragging.moved = true;
    dx = totalX;
    dy = totalY;
  }
  if (viewMode === 'map') {
    view.x -= dx / view.scale;
    view.z -= dy / view.scale;
    draw();
  } else {
    renderer?.turn(dx * .008);
    renderer?.lookVertical(dy * .008);
    // Pointer events can arrive far faster than the display. Coalesce them
    // into the next animation frame instead of running the full software
    // renderer once per event.
    lookMoved = true;
  }
  dragging.x = event.clientX; dragging.y = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (touch.enabled && (event.pointerType === 'touch' || event.pointerType === 'pen')) return;
  if (ending?.active) return;
  if (frontend.active) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 320, rect.height / 256);
    const nativeY = (event.clientY - rect.top - (rect.height - 256 * scale) / 2) / scale;
    void handleFrontendAction(frontend.activateRow(Math.floor(nativeY / 8)));
    draw();
    return;
  }
  if (event.button === 0) keys.delete('Mouse0');
  const moved = dragging?.moved;
  dragging = null;
  canvas.classList.remove('dragging');
  if (!moved && viewMode === 'map') selectNearest(event);
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('mousemove', event => {
  if (document.pointerLockElement !== canvas || viewMode !== 'first-person' ||
      paused || frontend.active || ending?.active || dead) return;
  if (event.movementX || event.movementY) {
    if (event.movementX) renderer?.turn(event.movementX * .008);
    if (event.movementY) renderer?.lookVertical(event.movementY * .008);
    lookMoved = true;
  }
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) keys.delete('Mouse0');
});
canvas.addEventListener('pointercancel', () => {
  keys.delete('Mouse0');
  dragging = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('lostpointercapture', () => {
  keys.delete('Mouse0');
  dragging = null;
  canvas.classList.remove('dragging');
});

// A browser may reuse a pointer id after a release was retargeted or lost.
// Drop the old emulated KeyMap byte before assigning that id to another
// coarse-control button; otherwise a stale Slash (retail strafe-right) survives
// every subsequent click. This changes only browser input delivery.
const releaseTouchPointer = event => {
  const code = touchPointers.get(event.pointerId);
  touchPointers.delete(event.pointerId);
  if (code && ![...touchPointers.values()].includes(code)) keys.delete(code);
};
document.querySelectorAll('[data-hold]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    void audio?.unlock();
    const code = button.dataset.hold;
    releaseTouchPointer(event);
    touchPointers.set(event.pointerId, code);
    button.setPointerCapture(event.pointerId);
    if (code === 'Space') operateQueued = true;
    else keys.add(code);
  });
  button.addEventListener('pointerup', releaseTouchPointer);
  button.addEventListener('pointercancel', releaseTouchPointer);
  button.addEventListener('lostpointercapture', releaseTouchPointer);
});
// A pointer release can be retargeted by fullscreen/layout changes before the
// originating coarse-control button sees it. Release its emulated KeyMap byte
// at the window boundary as well; duplicate delivery is intentionally safe.
addEventListener('pointerup', releaseTouchPointer, true);
addEventListener('pointercancel', releaseTouchPointer, true);
document.querySelectorAll('[data-action="duck"]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    void audio?.unlock();
    renderer?.toggleCrouch();
  });
});
document.querySelector('#touch-fullscreen').addEventListener('click', event => {
  event.preventDefault();
  void toggleFullscreen();
});

addEventListener('keydown', event => {
  void audio?.unlock();
  if (ending?.active) {
    event.preventDefault();
    if (event.code === 'Escape') openFrontend();
    else if (event.code === 'Space' || event.code === 'Enter') ending.skipIntro();
    draw();
    return;
  }
  if (dead) {
    event.preventDefault();
    if (event.code === 'Escape' || event.code === 'Space' || event.code === 'Enter') openFrontend(true);
    return;
  }
  if (frontend.active) {
    event.preventDefault();
    const action = frontend.key(event.code, event.key);
    void handleFrontendAction(action);
    draw();
    return;
  }
  if (paused && viewMode === 'first-person') {
    event.preventDefault();
    if (event.code === 'Escape') {
      openFrontend();
    } else if (event.code === 'KeyP' && !event.repeat) {
      setPaused(false);
    } else if (!event.repeat && (event.code === 'ArrowUp' || event.code === 'KeyW')) {
      const options = renderer?.changePauseOption('forward');
      if (options) {
        const channelCount = options.soundQuality < 2 ? 4 : 8;
        const stereo = (options.soundQuality & 1) !== 0;
        void audio?.setSourcePreferences(channelCount, stereo);
      }
      draw();
    } else if (!event.repeat && (event.code === 'ArrowDown' || event.code === 'KeyS')) {
      renderer?.changePauseOption('backward');
      draw();
    }
    return;
  }
  if (event.code === 'Escape' && viewMode === 'first-person') {
    event.preventDefault();
    openFrontend();
    return;
  }
  if (event.code === 'KeyP' && viewMode === 'first-person' && !event.repeat) {
    event.preventDefault();
    setPaused(true);
    return;
  }
  if (event.code === 'KeyX' && !event.repeat) {
    event.preventDefault();
    void toggleFullscreen();
    return;
  }
  if (event.code === 'KeyC' && !event.repeat && viewMode === 'first-person') {
    renderer?.toggleCrouch();
    event.preventDefault();
    return;
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF',
    'KeyC', 'ControlLeft', 'ControlRight',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Period', 'Slash',
    'ShiftLeft', 'ShiftRight', 'MetaRight', 'KeyL',
    'Space', ...GUN_KEYS.keys()].includes(event.code)) {
    keys.add(event.code);
    if (event.code === 'Space' && !event.repeat && viewMode === 'first-person') operateQueued = true;
    if (GUN_KEYS.has(event.code) && !event.repeat && viewMode === 'first-person') {
      if (renderer?.selectGun(GUN_KEYS.get(event.code))) draw();
    }
    if (viewMode === 'first-person') event.preventDefault();
  }
});
addEventListener('keyup', event => keys.delete(event.code));

// Browser delivery can end without the matching keyup/pointerup when the tab
// loses focus or pointer capture. Clearing only adapter state here does not
// alter plr1control.s movement; it prevents a stale browser event from holding
// one of its emulated KeyMap entries forever.
function releaseBrowserInputs() {
  keys.clear();
  touchPointers.clear();
  operateQueued = false;
  touchFireQueued = false;
  lookMoved = false;
  presentationDirty = false;
  touch.release();
  dragging = null;
  canvas.classList.remove('dragging');
}
addEventListener('blur', releaseBrowserInputs);
addEventListener('pagehide', releaseBrowserInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseBrowserInputs();
});

let previousFrame = performance.now();
let nextPresentationFrame = previousFrame;
const PRESENTATION_FRAME_INTERVAL = 1000 / 60;
function animate(now) {
  try {
    const elapsed = Math.min(.05, (now - previousFrame) / 1000);
    previousFrame = now;
    const gamepad = readGamepad(navigator.getGamepads?.() || [], previousGamepadButtons);
    previousGamepadButtons = gamepad.buttons;
    touch.updatePads();
    if (ending?.active) {
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.back)) openFrontend();
    else if (gamepad.pressed.has(GAMEPAD_BUTTONS.confirm)) ending.skipIntro();
    if (ending.update(elapsed)) draw();
  } else if (frontend.active) {
    let action = null;
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.up)) action = frontend.key('ArrowUp');
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.down)) action = frontend.key('ArrowDown');
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.confirm)) action = frontend.key('Enter');
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.back)) action = frontend.key('Escape');
    if (action) void handleFrontendAction(action);
    if (gamepad.pressed.size) draw();
  } else if (!frontend.active && !campaignTransitionPending && !paused && !dead &&
      viewMode === 'first-person' && renderer && level) {
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.pause)) setPaused(true);
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.menu)) openFrontend();
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.operate)) operateQueued = true;
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.duck)) renderer.toggleCrouch();
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.previousWeapon)) cycleGun(-1);
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.nextWeapon)) cycleGun(1);
    if (paused || frontend.active) return;
    const touchDirection = touch.direction();
    touch.lookRate(elapsed);
    // Preserve the individual KeyMap tests used by
    // plr1control.s:PLR1_keyboard_control. Collapsing opposite buttons to one
    // axis loses the released test order (notably forward+back and both
    // strafe keys), while the browser gamepad remains a digital action alias.
    const forwardPressed = keys.has('KeyW') || keys.has('ArrowUp') ||
      gamepad.forward > 0 || touchDirection.forwardPressed;
    const backwardPressed = keys.has('KeyS') || keys.has('ArrowDown') ||
      gamepad.forward < 0 || touchDirection.backwardPressed;
    const strafeLeft = keys.has('Period') || keys.has('KeyA') ||
      gamepad.sideways < 0 || touchDirection.strafeLeft;
    const strafeRight = keys.has('Slash') || keys.has('KeyD') ||
      gamepad.sideways > 0 || touchDirection.strafeRight;
    const turnLeft = keys.has('KeyQ') || keys.has('ArrowLeft') || gamepad.turning < 0;
    const turnRight = keys.has('KeyE') || keys.has('ArrowRight') || gamepad.turning > 0;
    const forward = Number(forwardPressed) - Number(backwardPressed);
    const sideways = Number(strafeRight) - Number(strafeLeft);
    const turning = Number(turnRight) - Number(turnLeft);
    const fire = keys.has('Mouse0') || keys.has('KeyF') || keys.has('ControlLeft') ||
      keys.has('ControlRight') || gamepad.fire || touchFireQueued;
    const moving = renderer.control(level, elapsed, {
      forward, sideways, turning, forwardPressed, backwardPressed,
      strafeLeft, strafeRight, turnLeft, turnRight,
      running: keys.has('ShiftRight') || keys.has('ShiftLeft') ||
        gamepad.running || touch.enabled,
      forceSidestep: keys.has('MetaRight'),
      lookBehind: keys.has('KeyL'),
    });
    const dynamic = renderer.update(level, elapsed, operateQueued, fire);
    operateQueued = false;
    touchFireQueued = false;
    audio?.process(renderer.world, renderer.camera);
    presentationDirty ||= moving || dynamic || lookMoved;
    const interpolating = renderer.needsPresentationFrame();
    if (renderer.sourcePixels) {
      // Original retains the source-tick presentation cadence.
      if (presentationDirty) draw();
      presentationDirty = false;
      nextPresentationFrame = now;
    } else if ((presentationDirty || interpolating) && now >= nextPresentationFrame) {
      // Sharp modes interpolate the exact 50 Hz camera states for browser
      // presentation only. Bound software rendering to 60 Hz on high-refresh
      // displays while carrying a skipped dirty frame forward.
      draw();
      presentationDirty = false;
      if (now - nextPresentationFrame > PRESENTATION_FRAME_INTERVAL * 4) {
        nextPresentationFrame = now + PRESENTATION_FRAME_INTERVAL;
      } else {
        do nextPresentationFrame += PRESENTATION_FRAME_INTERVAL;
        while (nextPresentationFrame <= now);
      }
    }
    lookMoved = false;
    if (renderer.world.completed) {
      finishLevel();
    } else if (renderer.world.playerState.energy <= 0) {
      dead = true;
      keys.clear();
      document.querySelector('#map-help').textContent =
        'Game over · Enter/Space/Escape returns to the retail title';
      draw();
    }
  } else if (paused) {
    if (gamepad.pressed.has(GAMEPAD_BUTTONS.back)
        || gamepad.pressed.has(GAMEPAD_BUTTONS.menu)) openFrontend();
    else if (gamepad.pressed.has(GAMEPAD_BUTTONS.pause)) setPaused(false);
    else if (gamepad.pressed.has(GAMEPAD_BUTTONS.up)) {
      const options = renderer?.changePauseOption('forward');
      if (options) {
        const channelCount = options.soundQuality < 2 ? 4 : 8;
        const stereo = (options.soundQuality & 1) !== 0;
        void audio?.setSourcePreferences(channelCount, stereo);
      }
      draw();
    } else if (gamepad.pressed.has(GAMEPAD_BUTTONS.down)) {
      renderer?.changePauseOption('backward');
      draw();
    }
    } else if (dead && (gamepad.pressed.has(GAMEPAD_BUTTONS.confirm)
      || gamepad.pressed.has(GAMEPAD_BUTTONS.back))) {
      openFrontend(true);
    }
  } catch (error) {
    // Keep browser input and subsequent animation frames alive even when an
    // exact diagnostic boundary rejects one frame. The visible canvas is
    // transactional in draw(), so this no longer presents a permanent black
    // screen while retaining the actual exception for investigation.
    reportRuntimeError(error);
  } finally {
    requestAnimationFrame(animate);
  }
}
requestAnimationFrame(animate);

new ResizeObserver(resize).observe(canvas);
export const ready = start().then(() => true).catch(error => {
  errorBox.textContent = error.stack || error.message;
  return false;
});
