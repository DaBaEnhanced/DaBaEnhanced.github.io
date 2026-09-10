import { EventBus } from "../../../shared/js/EventBus.js";
import { createInitialState } from "../../../shared/js/State.js";
import { evaluateCondition } from "../../../shared/js/ConditionEvaluator.js";
import { findPath, pointInShape, resolveWalkTarget, scaleAtPosition } from "../../../shared/js/Navigation.js";
import { characterMovementSpeed, movementFacing } from "../../../shared/js/Characters.js";
import { characterWorldBounds } from "../../../shared/js/Characters.js";
import { createPatrolState, updatePatrolState } from "../../../shared/js/Patrol.js";
import { ActionRunner } from "./ActionRunner.js";
import { Renderer } from "../render/Renderer.js";
import { InventorySystem } from "../systems/InventorySystem.js";
import { DialogueSystem } from "../systems/DialogueSystem.js";
import { SaveSystem } from "../systems/SaveSystem.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { AnimationSoundSystem } from "../systems/AnimationSoundSystem.js";
import { FMVSystem } from "../systems/FMVSystem.js";
import { clampRoomCamera, interpolateRoomCamera, screenToRoom, snapRoomCamera, snapRoomCameraToFocus, updateRoomCamera } from "../../../shared/js/RoomCamera.js";
import { GameUI } from "../ui/GameUI.js";

export function resolveRoomArrival(room, position, destinationNode) {
  if (!destinationNode) return position;
  const node = (room?.navNodes ?? []).find((entry) => entry.id === destinationNode);
  if (!node) throw new Error(`Missing destination navigation node: ${room?.id}.${destinationNode}`);
  return node;
}

export function roomEntryActionGroups(room, firstEnter) { return [room.events?.onEnter ?? [], ...(firstEnter ? [room.events?.onFirstEnter ?? []] : [])]; }
export function roomPeriodicInterval(room) { const seconds = Number(room?.events?.periodicInterval ?? 1); return Number.isFinite(seconds) && seconds > 0 ? seconds : 1; }

export class Game {
  constructor(project, canvas) {
    this.project = project;
    this.canvas = canvas;
    this.width = project.game.logicalWidth ?? 320; this.height = project.game.logicalHeight ?? 180; canvas.width = this.width; canvas.height = this.height; document.documentElement.style.setProperty("--game-aspect", `${this.width} / ${this.height}`); document.documentElement.style.setProperty("--game-aspect-value", String(this.width / this.height));
    this.room = project.rooms.get(project.game.startRoom);
    this.closeup = null;
    this.state = createInitialState(project, this.room);
    this.events = new EventBus();
    this.renderer = new Renderer(this, canvas);
    this.actions = new ActionRunner(this);
    this.inventory = new InventorySystem(this);
    this.dialogue = new DialogueSystem(this);
    this.save = new SaveSystem(this);
    this.audio = new AudioSystem(project);
    this.fmv = new FMVSystem(this);
    this.animationSoundOverrides = new Map(); this.animationSounds = new AnimationSoundSystem(this); this.nextAnimationSoundInstance = 1;
    this.ui = new GameUI(this);
    this.inputEnabled = false;
    this.verb = "walk";
    this.selectedItem = null;
    this.hovered = null;
    this.walkPath = [];
    this.walkResolve = null;
    this.lastTick = performance.now();
    this.layerOverrides = new Map();
    this.layerStateOverrides = new Map();
    this.layerAnimationStarts = new Map();
    this.animationLoopOverrides = new Map();
    this.roomAnimationStartedAt = performance.now();
    this.hotspotOverrides = new Map();
    this.characterStateOverrides = new Map();
    this.characterVisibilityOverrides = new Map();
    this.effects = [];
    this.screenAnimations = [];
    this.npcStates = new Map();
    this.camera = snapRoomCamera(this.room, { width: this.width, height: this.height }, this.state.player);
    this.cameraFocus = null;
    this.cameraTransition = null;
    this.roomPeriodicElapsed = 0;
    this.roomPeriodicActionsRunning = false;
    this.roomPeriodicReady = false;
    this.roomExitInProgress = null;
    this.roomChangeGeneration = 0;
    this.debug = new URLSearchParams(location.search).has("debug");
  }

  async prepare() {
    if (this.prepared) return;
    this.prepared = true;
    this.ui.bind(); this.bindInput();
    await this.renderer.preloadRoom(this.room);
    this.resetRoomLayerAnimations();
    this.setupRoomCharacters();
    this.ui.renderInventory(); this.setVerb("walk");
    document.querySelector("#loading").classList.add("hidden");
  }

  begin() {
    if (!this.beginPromise) {
      this.lastTick = performance.now();
      this.renderer.start(); this.tick();
      this.beginPromise = this.enterRoom(true);
    }
    return this.beginPromise;
  }

  async start() {
    await this.prepare();
    await this.begin();
  }

  unlockAudio() { this.audio.unlock(); this.fmv.unlockAudio(); }

  bindInput() {
    const toLogical = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const point = { x: (event.clientX - rect.left) * this.width / rect.width, y: (event.clientY - rect.top) * this.height / rect.height };
      return this.closeup ? point : screenToRoom(point, this.camera);
    };
    this.canvas.addEventListener("pointermove", (event) => { this.hovered = this.hitTest(toLogical(event)); this.ui.updateStatus(); });
    this.canvas.addEventListener("pointerleave", () => { this.hovered = null; this.ui.updateStatus(); });
    this.canvas.addEventListener("pointerdown", (event) => {
      this.unlockAudio();
      if (this.dialogue.advance()) return;
      if (!this.inputEnabled) return;
      const point = toLogical(event);
      this.handleClick(point, event.button === 2 ? "look" : this.verb).catch((error) => this.handleError(error));
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("keydown", (event) => {
      this.unlockAudio();
      if ((event.key === " " || event.key === "Enter") && this.dialogue.advance()) return;
      if (["1", "2", "3", "4", "5"].includes(event.key)) this.setVerb(["walk", "look", "use", "talk", "pickUp"][Number(event.key) - 1]);
      if (event.key.toLowerCase() === "h") { this.state.settings.hotspotAssist = !this.state.settings.hotspotAssist; this.ui.toast(`Hotspot assist ${this.state.settings.hotspotAssist ? "on" : "off"}`); }
      if (event.key.toLowerCase() === "d") { this.debug = !this.debug; this.ui.toast(`Debug ${this.debug ? "on" : "off"}`); }
      if (event.key === "Escape") { this.selectedItem = null; this.setVerb("walk"); this.ui.renderInventory(); }
    });
  }

  setVerb(verb) { this.verb = verb; if (verb !== "use") this.selectedItem = null; this.ui.setVerb(verb); this.ui.renderInventory(); }
  selectItem(itemId) {
    if (this.selectedItem && this.selectedItem !== itemId) return this.inventory.combine(this.selectedItem, itemId).catch((error) => this.handleError(error));
    this.selectedItem = this.selectedItem === itemId ? null : itemId; this.verb = "use"; this.ui.setVerb("use"); this.ui.renderInventory();
  }

  activeHotspots() {
    const entries = this.closeup ? this.closeup.hotspots ?? [] : [...(this.room.hotspots ?? []), ...(this.room.exits ?? []).map((exit) => ({ ...exit, isExit: true })), ...this.activeCharacterTargets()];
    return entries.filter((entry) => { const override = this.hotspotOverride(entry.id); return override === undefined ? evaluateCondition(entry.activeIf, this.state) : override; });
  }
  closeupState(closeupId = this.closeup?.id) { if (!closeupId) return null; this.state.closeupState ??= {}; return this.state.closeupState[closeupId] ??= { layerVisibility: {}, layerStates: {}, hotspotActive: {} }; }
  layerVisibilityOverride(layerId) { return this.closeup ? this.closeupState().layerVisibility[layerId] : this.layerOverrides.get(layerId); }
  layerStateOverride(layerId) { return this.closeup ? this.closeupState().layerStates[layerId] : this.layerStateOverrides.get(layerId); }
  hotspotOverride(hotspotId) { return this.closeup ? this.closeupState().hotspotActive[hotspotId] : this.hotspotOverrides.get(hotspotId); }
  setLayerVisibilityOverride(layerId, visible) { if (this.closeup) this.closeupState().layerVisibility[layerId] = visible !== false; else this.layerOverrides.set(layerId, visible !== false); }
  setLayerStateOverride(layerId, state) { if (this.closeup) this.closeupState().layerStates[layerId] = state; else this.layerStateOverrides.set(layerId, state); }
  setHotspotOverride(hotspotId, active) { if (this.closeup) this.closeupState().hotspotActive[hotspotId] = active !== false; else this.hotspotOverrides.set(hotspotId, active !== false); }
  layerAnimationSoundKey(layerId) { return `layer:${this.closeup ? `closeup:${this.closeup.id}` : this.room?.id}:${layerId}`; }
  resetLayerAnimation(layerId, startedAt = performance.now()) { this.layerAnimationStarts.set(layerId, startedAt); this.animationSounds.reset(this.layerAnimationSoundKey(layerId)); }
  resetRoomLayerAnimations(startedAt = performance.now()) { this.layerAnimationStarts.clear(); this.roomAnimationStartedAt = startedAt; this.animationSounds.clear(); }
  setAnimationLooping(animationId, enabled, changedAt = performance.now()) {
    const animation = this.project.animations.get(animationId); if (!animation) throw new Error(`Missing animation: ${animationId}`);
    const previous = this.animationLoopOverrides.get(animationId); const loopWasEnabled = previous?.enabled ?? animation.loop !== false;
    this.animationLoopOverrides.set(animationId, { enabled: enabled !== false, changedAt, loopWasEnabled });
  }
  animationLoopPlayback(animationId, startedAt = 0) {
    const override = this.animationLoopOverrides.get(animationId);
    return override ? { looping: override.enabled, loopChangedAtMs: override.changedAt - startedAt, loopWasEnabled: override.loopWasEnabled } : undefined;
  }
  roomCharacterKey(placement, index = this.room.characters.indexOf(placement)) { return placement.id ?? `${placement.characterId}:${index}`; }
  playerCharacterId(room = this.room) { return this.state.player.characterId ?? room?.playerCharacter ?? "ren"; }
  async changePlayerCharacter(characterId) {
    const character = this.project.characters.get(characterId); if (!character) throw new Error(`Missing character: ${characterId}`);
    await this.renderer.preloadCharacter(character);
    this.state.player.characterId = characterId; this.characterStateOverrides.delete("player"); this.renderer.resetCharacterPlayback("player"); this.animationSounds.reset("character:player");
    this.events.emit("player:character-changed", { characterId });
  }
  setupRoomCharacters() { for (const npc of this.npcStates.values()) npc.scriptedResolve?.(); this.npcStates.clear(); for (const [index, placement] of (this.room.characters ?? []).entries()) this.npcStates.set(this.roomCharacterKey(placement, index), createPatrolState(placement, this.room.navNodes)); }
  roomCharacterState(key) {
    if (key === "player") return this.state.player;
    const state = this.npcStates.get(key); if (!state) throw new Error(`Missing room character placement: ${key}`); return state;
  }
  faceRoomCharacter(key, direction) { this.roomCharacterState(key).facing = direction; }
  setRoomCharacterPatrolEnabled(key, enabled) {
    if (!key || key === "player") throw new Error("Player characters do not have NPC patrols");
    const placement = (this.room.characters ?? []).find((entry, index) => this.roomCharacterKey(entry, index) === key); if (!placement) throw new Error(`Missing room character placement: ${key}`); if (!placement.patrol) throw new Error(`Character placement has no patrol: ${key}`);
    const npc = this.roomCharacterState(key); npc.patrolEnabled = enabled !== false; npc.path = []; npc.followTarget = null; npc.followPathComplete = false; npc.moving = Boolean(npc.scriptedPath); npc.waitRemaining = 0; if (npc.patrolEnabled) npc.stopped = false;
  }
  setRoomCharacterFollowPlayer(key, enabled = true, minimumDistance = 24) {
    if (!key || key === "player") throw new Error("The player cannot follow itself");
    const placement = (this.room.characters ?? []).find((entry, index) => this.roomCharacterKey(entry, index) === key); if (!placement) throw new Error(`Missing room character placement: ${key}`);
    const npc = this.roomCharacterState(key); const distance = Number(minimumDistance);
    npc.followPlayer = enabled === false ? null : { enabled: true, minimumDistance: Number.isFinite(distance) ? Math.max(0, distance) : 24 };
    npc.followTarget = null; npc.followPathComplete = false; npc.path = []; npc.waitRemaining = 0; npc.moving = Boolean(npc.scriptedPath);
  }
  setRoomCharacterPosition(key, target) {
    if (key === "player") {
      if (this.walkResolve) { this.walkResolve(); this.walkResolve = null; } this.walkPath = [];
      Object.assign(this.state.player, target, { scale: scaleAtPosition(this.room.navNodes, target, this.state.player.scale ?? 1) }); return;
    }
    const npc = this.roomCharacterState(key); npc.scriptedResolve?.(); delete npc.scriptedResolve; delete npc.scriptedPath;
    npc.path = []; npc.followTarget = null; npc.followPathComplete = false; npc.paused = false; npc.moving = false; Object.assign(npc, target, { scale: scaleAtPosition(this.room.navNodes, target, npc.scale ?? 1) });
  }
  walkCharacterTo(key, target) {
    if (key === "player") return this.walkTo(target);
    const npc = this.roomCharacterState(key); npc.scriptedResolve?.(); npc.path = []; npc.followTarget = null; npc.followPathComplete = false; npc.paused = true;
    npc.scriptedPath = findPath(this.room.navNodes, npc, target);
    if (!npc.scriptedPath.length) { this.setRoomCharacterPosition(key, target); return Promise.resolve(); }
    return new Promise((resolve) => { npc.scriptedResolve = resolve; });
  }
  activeCharacterTargets() {
    const targets = [];
    for (const [index, placement] of (this.room.characters ?? []).entries()) {
      const interaction = placement.interaction; if (!interaction || interaction.enabled === false || !evaluateCondition(placement.visibleIf, this.state)) continue;
      const character = this.project.characters.get(placement.characterId); const key = this.roomCharacterKey(placement, index); const npc = this.npcStates.get(key) ?? placement; const scale = (npc.scale ?? scaleAtPosition(this.room.navNodes, npc, 1)) * (character?.defaultScale ?? 1);
      targets.push({ ...interaction, id: `character:${key}`, name: interaction.name ?? character?.name ?? placement.characterId, defaultVerb: interaction.defaultVerb ?? "talk", shape: { type: "rectangle", ...characterWorldBounds(character, npc, scale) }, isCharacter: true, placementKey: key, characterId: placement.characterId });
    }
    return targets;
  }
  hitTest(point) { return [...this.activeHotspots()].reverse().find((hotspot) => pointInShape(point, hotspot.shape)) ?? null; }

  async handleClick(point, requestedVerb) {
    const target = this.hitTest(point);
    if (!target) { this.selectedItem = null; this.ui.renderInventory(); return this.closeup ? undefined : this.walkTo(point); }
    const npc = target.isCharacter ? this.npcStates.get(target.placementKey) : null; if (npc) npc.paused = true;
    try {
      const approach = this.closeup ? null : target.isCharacter && target.walkTo?.followCharacter && npc
        ? { x: npc.x + (target.walkTo.offsetX ?? -24 * this.width / 320), y: npc.y + (target.walkTo.offsetY ?? 0), scale: npc.scale, facing: target.walkTo.facing }
        : resolveWalkTarget(this.room.navNodes, target.walkTo);
      if (approach) { await this.walkTo(approach); if (approach.facing) this.state.player.facing = approach.facing; }
      if (target.isExit) {
        if (target.lockedIf && evaluateCondition(target.lockedIf, this.state)) return this.actions.run(target.lockedActions ?? []);
        return this.changeRoom(target.targetRoom, target.targetPosition, target.targetFacing, target.transition, false, target.destinationNode);
      }
      let actions;
      const usingItem = Boolean(this.selectedItem && requestedVerb !== "look");
      if (usingItem) actions = target.itemInteractions?.[this.selectedItem] ?? target.itemFallback;
      else {
        const verb = requestedVerb === "walk" ? target.defaultVerb ?? "look" : requestedVerb;
        actions = target.interactions?.[verb]?.actions ?? target.interactions?.[verb];
      }
      if (!actions?.length) actions = [{ type: "say", speaker: "Ren", text: this.selectedItem ? "That won't help here." : "Nothing useful happens." }];
      this.inputEnabled = false;
      await this.actions.run(actions, { hotspotId: target.id, characterId: target.characterId, itemId: this.selectedItem });
      if (usingItem) this.selectedItem = null;
      this.ui.renderInventory(); this.inputEnabled = true;
    } finally { if (npc) npc.paused = false; }
  }

  walkTo(target) {
    if (this.walkResolve) { this.walkResolve(); this.walkResolve = null; }
    this.walkPath = findPath(this.room.navNodes, this.state.player, target);
    return new Promise((resolve) => { this.walkResolve = resolve; });
  }

  async showCloseup(closeupId, reset = false) {
    const closeup = this.project.closeups?.get(closeupId); if (!closeup) throw new Error(`Missing close-up: ${closeupId}`);
    if (reset) { this.state.closeupState ??= {}; delete this.state.closeupState[closeupId]; }
    this.closeup = closeup; this.closeupState(closeupId); this.hovered = null; this.selectedItem = null; this.ui.renderInventory();
    this.layerAnimationStarts.clear(); this.roomAnimationStartedAt = performance.now(); this.animationSounds.clear();
    await this.renderer.preloadCloseup(closeup);
  }

  closeCloseup() { if (!this.closeup) return; this.closeup = null; this.hovered = null; this.layerAnimationStarts.clear(); this.roomAnimationStartedAt = performance.now(); this.animationSounds.clear(); }

  tick() {
    const now = performance.now(); const dt = Math.min(.05, (now - this.lastTick) / 1000); this.lastTick = now;
    if (this.walkPath.length) {
      const character = this.project.characters.get(this.playerCharacterId()); const completed = advanceCharacterPath(this.state.player, this.walkPath, character, dt, this.room.directionSettings);
      if (completed && this.walkResolve) { const resolve = this.walkResolve; this.walkResolve = null; resolve(); }
    }
    this.state.playTimeSeconds += dt;
    for (const [index, placement] of (this.room.characters ?? []).entries()) {
      const npc = this.npcStates.get(this.roomCharacterKey(placement, index)); if (!npc) continue;
      const character = this.project.characters.get(placement.characterId);
      if (npc.scriptedPath) updateScriptedCharacter(npc, character, dt, this.room.directionSettings);
      else if (!updateFollowingCharacter(npc, this.state.player, this.room.navNodes ?? [], character, dt, this.room.directionSettings)) updatePatrolState(npc, placement, this.room.navNodes ?? [], character, dt, this.room.directionSettings);
    }
    this.updateSceneCamera(dt);
    this.updatePeriodicRoomEvents(dt);
    requestAnimationFrame(() => this.tick());
  }

  resetPeriodicRoomEvents() { this.roomPeriodicElapsed = 0; this.roomPeriodicActionsRunning = false; this.roomPeriodicReady = false; }

  updatePeriodicRoomEvents(deltaSeconds) {
    const actions = this.room?.events?.onPeriodic ?? [];
    if (!this.roomPeriodicReady || !actions.length) { this.roomPeriodicElapsed = 0; return; }
    if (this.roomPeriodicActionsRunning) return;
    this.roomPeriodicElapsed += Math.max(0, Number(deltaSeconds) || 0);
    const interval = roomPeriodicInterval(this.room);
    if (this.roomPeriodicElapsed < interval || !this.inputEnabled) return;
    this.roomPeriodicElapsed = 0;
    const room = this.room; this.roomPeriodicActionsRunning = true;
    this.actions.run(actions, { roomId: room.id, periodic: true })
      .catch((error) => this.handleError(error))
      .finally(() => { this.roomPeriodicActionsRunning = false; });
  }

  moveSceneFocus(target, duration = 1000) {
    const focus = { x: Number(target?.x) || 0, y: Number(target?.y) || 0 }; const viewport = { width: this.width, height: this.height };
    this.cameraFocus = focus;
    return this.startCameraTransition(snapRoomCameraToFocus(this.room, viewport, focus), duration);
  }

  releaseSceneFocus(duration = 1000) {
    const viewport = { width: this.width, height: this.height }; this.cameraFocus = null;
    return this.startCameraTransition(snapRoomCamera(this.room, viewport, this.state.player), duration);
  }

  startCameraTransition(to, duration) {
    this.finishCameraTransition(); const milliseconds = Math.max(0, Number(duration) || 0);
    if (!milliseconds) { this.camera = clampRoomCamera(to, this.room, { width: this.width, height: this.height }); return Promise.resolve(); }
    return new Promise((resolve) => { this.cameraTransition = { from: { ...this.camera }, to, duration: milliseconds, elapsed: 0, resolve }; });
  }

  finishCameraTransition() {
    const transition = this.cameraTransition; this.cameraTransition = null; transition?.resolve?.();
  }

  updateSceneCamera(deltaSeconds) {
    const viewport = { width: this.width, height: this.height }; const transition = this.cameraTransition;
    if (transition) {
      transition.elapsed += Math.max(0, deltaSeconds) * 1000; const progress = Math.min(1, transition.elapsed / transition.duration);
      this.camera = clampRoomCamera(interpolateRoomCamera(transition.from, transition.to, progress), this.room, viewport);
      if (progress >= 1) this.finishCameraTransition();
      return;
    }
    if (this.cameraFocus) this.camera = snapRoomCameraToFocus(this.room, viewport, this.cameraFocus);
    else this.camera = updateRoomCamera(this.camera, this.room, viewport, this.state.player, deltaSeconds);
  }

  async runRoomExitActions(room = this.room, restoring = false) {
    if (restoring || !room || this.roomExitInProgress === room) return this.room === room;
    const generation = this.roomChangeGeneration;
    this.roomExitInProgress = room;
    try {
      await this.actions.run(room.events?.onExit ?? [], { roomId: room.id, exiting: true });
      return this.room === room && this.roomChangeGeneration === generation;
    } finally { if (this.roomExitInProgress === room) this.roomExitInProgress = null; }
  }

  async changeRoom(roomId, position, facing, transition = true, restoring = false, destinationNode = null) {
    const nextRoom = this.project.rooms.get(roomId); if (!nextRoom) throw new Error(`Missing room: ${roomId}`);
    const arrival = resolveRoomArrival(nextRoom, position, destinationNode);
    this.roomChangeGeneration = (this.roomChangeGeneration ?? 0) + 1;
    this.resetPeriodicRoomEvents();
    this.inputEnabled = false;
    const leavingRoom = this.room;
    if (!await this.runRoomExitActions(leavingRoom, restoring)) return;
    if (transition !== false) await this.fade("black", transition?.duration);
    this.events.emit("room:left", { roomId: this.room.id });
    this.actions.cancelScheduled();
    this.cameraFocus = null; this.finishCameraTransition();
    this.closeup = null; this.room = nextRoom; this.state.currentRoom = roomId; this.walkPath = []; this.layerOverrides.clear(); this.layerStateOverrides.clear(); this.layerAnimationStarts.clear(); this.animationLoopOverrides.clear(); this.hotspotOverrides.clear(); this.characterStateOverrides.clear(); this.characterVisibilityOverrides.clear(); this.animationSoundOverrides.clear(); for (const [cue, override] of Object.entries(this.state.roomState[roomId]?.animationSoundOverrides ?? {})) this.animationSoundOverrides.set(cue, override); this.animationSounds.clear();
    this.setupRoomCharacters();
    this.state.player.x = arrival?.[0] ?? arrival?.x ?? nextRoom.playerStart.x;
    this.state.player.y = arrival?.[1] ?? arrival?.y ?? nextRoom.playerStart.y;
    this.state.player.facing = facing ?? arrival?.facing ?? nextRoom.playerStart.facing;
    const placedPosition = { x: this.state.player.x, y: this.state.player.y, scale: arrival?.scale };
    this.state.player.scale = scaleAtPosition(nextRoom.navNodes, placedPosition, nextRoom.playerStart.scale ?? 1);
    this.camera = snapRoomCamera(nextRoom, { width: this.width, height: this.height }, this.state.player);
    try { await this.renderer.preloadRoom(nextRoom); }
    catch (error) { document.querySelector("#fade")?.classList.remove("opaque"); throw error; }
    this.resetRoomLayerAnimations();
    if (transition !== false) await this.fade("clear", transition?.duration);
    await this.enterRoom(!this.state.visitedRooms.includes(roomId), restoring);
  }

  async enterRoom(firstEnter, restoring = false) {
    this.resetPeriodicRoomEvents();
    if (!this.state.visitedRooms.includes(this.room.id)) this.state.visitedRooms.push(this.room.id);
    this.events.emit("room:entered", { roomId: this.room.id, firstEnter });
    this.inputEnabled = true;
    if (!restoring) {
      const enteredRoom = this.room;
      for (const actions of roomEntryActionGroups(enteredRoom, firstEnter)) { await this.actions.run(actions); if (this.room !== enteredRoom) return; }
      if (!firstEnter) await this.save.autosave();
    }
    this.roomPeriodicReady = true;
  }
  refreshConditions() { /* Conditions are evaluated at render/hit-test time. */ }
  wait(ms = 0) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  async fade(to, duration = 350) { const element = document.querySelector("#fade"); element.style.transitionDuration = `${duration ?? 350}ms`; element.classList.toggle("opaque", to === "black"); await this.wait(duration ?? 350); }
  handleError(error) { console.error(error); this.ui.toast(`Runtime error: ${error.message}`); this.inputEnabled = true; }
}

export function updateScriptedCharacter(state, character, dt, directionSettings) {
  if (advanceCharacterPath(state, state.scriptedPath, character, dt, directionSettings)) finishScriptedCharacter(state);
}

export function followPlayerDestination(follower, player, minimumDistance = 24) {
  const dx = (Number(follower?.x) || 0) - (Number(player?.x) || 0); const dy = (Number(follower?.y) || 0) - (Number(player?.y) || 0); const distance = Math.hypot(dx, dy); const spacing = Math.max(0, Number(minimumDistance) || 0);
  if (distance <= spacing) return null;
  return { x: player.x + dx / distance * spacing, y: player.y + dy / distance * spacing };
}

export function updateFollowingCharacter(state, player, nodes, character, dt, directionSettings = {}) {
  const follow = state.followPlayer; if (!follow?.enabled) return false;
  state.moving = false; if (state.paused) return true;
  const destination = followPlayerDestination(state, player, follow.minimumDistance);
  if (!destination) { state.path = []; state.followTarget = null; state.followPathComplete = true; return true; }
  const repathDistance = Math.max(3, (follow.minimumDistance ?? 24) * .2); const previous = state.followTarget;
  if (!previous || Math.hypot(destination.x - previous.x, destination.y - previous.y) >= repathDistance) {
    state.path = findPath(nodes, state, destination); state.followTarget = destination; state.followPathComplete = false;
  }
  if (state.path?.length && advanceCharacterPath(state, state.path, character, dt, directionSettings)) state.followPathComplete = true;
  return true;
}

export function advanceCharacterPath(state, path, character, dt, directionSettings) {
  const target = path?.[0]; if (!target) { state.moving = false; return true; }
  const dx = target.x - state.x; const dy = target.y - state.y; const distance = Math.hypot(dx, dy); const targetScale = target.scale ?? state.scale ?? 1;
  state.facing = movementFacing({ dx, dy, currentScale: state.scale ?? 1, targetScale, previousFacing: state.facing }, directionSettings);
  const speed = characterMovementSpeed(character, state.facing); const step = Math.min(distance, speed * dt); state.moving = distance > .01;
  state.scale = distance ? state.scale + (targetScale - state.scale) * (step / distance) : targetScale;
  if (distance <= speed * dt) { state.x = target.x; state.y = target.y; state.scale = targetScale; path.shift(); }
  else { state.x += dx / distance * step; state.y += dy / distance * step; }
  return path.length === 0;
}

function finishScriptedCharacter(state) {
  const resolve = state.scriptedResolve; delete state.scriptedPath; delete state.scriptedResolve; state.moving = false; state.paused = false; resolve?.();
}
