import { evaluateCondition } from "../../../shared/js/ConditionEvaluator.js";
import { animationDurationMs } from "../../../shared/js/Assets.js";

export const ACTION_HANDLERS = {
  say: ({ game }, action) => game.dialogue.say(action.speaker, action.text),
  narrate: ({ game }, action) => game.dialogue.say("", action.text),
  wait: ({ game }, action) => game.wait(action.ms),
  walkCharacter: ({ game }, action) => game.walkCharacterTo(action.character || "player", { x: action.x, y: action.y }),
  faceCharacter: ({ game }, action) => game.faceRoomCharacter(action.character || "player", action.direction),
  setCharacterPosition: ({ game }, action) => game.setRoomCharacterPosition(action.character || "player", { x: action.x, y: action.y }),
  setCharacterState: ({ game }, action) => setCharacterState(game, action),
  changePlayerCharacter: ({ game }, action) => game.changePlayerCharacter(action.character),
  setCharacterVisible: ({ game }, action) => setCharacterVisible(game, action),
  setCharacterPatrolEnabled: ({ game }, action) => game.setRoomCharacterPatrolEnabled(action.character, action.enabled),
  followPlayer: ({ game }, action) => game.setRoomCharacterFollowPlayer(action.character, action.enabled, action.minimumDistance),
  setFlag: ({ game }, action) => { game.state.flags[action.flag] = action.value; game.events.emit("flag:changed", action); },
  toggleFlag: ({ game }, action) => { const value = !Boolean(game.state.flags[action.flag]); game.state.flags[action.flag] = value; game.events.emit("flag:changed", { ...action, value }); },
  if: (runner, action, context) => runner.run(evaluateCondition(action.condition, runner.game.state, context) ? action.then : action.else, context),
  setVar: ({ game }, action) => { game.state.vars[action.var] = action.value; },
  incrementVar: ({ game }, action) => { game.state.vars[action.var] = (game.state.vars[action.var] ?? 0) + (action.amount ?? 1); },
  setRoomVar: ({ game }, action) => { const room = action.room ?? game.state.currentRoom; game.state.roomState[room] ??= {}; game.state.roomState[room][action.key] = action.value; },
  addItem: ({ game }, action) => game.inventory.add(action.item),
  removeItem: ({ game }, action) => game.inventory.remove(action.item),
  changeRoom: ({ game }, action) => game.changeRoom(action.room, action.position, action.facing, action.transition, false, action.destinationNode),
  showCloseup: ({ game }, action) => game.showCloseup(action.closeup, action.reset),
  closeCloseup: ({ game }) => game.closeCloseup(),
  moveSceneFocus: ({ game }, action) => cameraAction(game.moveSceneFocus({ x: action.x, y: action.y }, action.duration), action),
  releaseSceneFocus: ({ game }, action) => cameraAction(game.releaseSceneFocus(action.duration), action),
  startDialogue: ({ game }, action, context) => game.dialogue.start(action.dialogue, context),
  startCutscene: (runner, action, context) => runner.run(runner.game.project.cutscenes.get(action.cutscene)?.actions, context),
  disableInput: ({ game }) => { game.inputEnabled = false; },
  enableInput: ({ game }) => { game.inputEnabled = true; },
  fadeScreen: ({ game }, action) => game.fade(action.to, action.duration),
  setLayerVisible: ({ game }, action) => setLayerVisible(game, action, action.visible),
  showLayer: ({ game }, action) => setLayerVisible(game, action, true),
  hideLayer: ({ game }, action) => setLayerVisible(game, action, false),
  changeLayerState: ({ game }, action) => { if (game.setLayerStateOverride) game.setLayerStateOverride(action.layer, action.layerState); else game.layerStateOverrides.set(action.layer, action.layerState); resetLayerAnimation(game, action.layer); },
  setHotspotActive: ({ game }, action) => { if (game.setHotspotOverride) game.setHotspotOverride(action.hotspot, action.active); else game.hotspotOverrides.set(action.hotspot, action.active); },
  toast: ({ game }, action) => game.ui.toast(action.text),
  save: ({ game }) => game.save.autosave(),
  playSound: ({ game }, action) => game.audio.playSound ? game.audio.playSound(action.sound, action) : game.audio.playTone(action.sound),
  stopSound: ({ game }, action) => game.audio.stopSound(action.sound, action.fade),
  playMusic: ({ game }, action) => game.audio.playMusic(action.music, action),
  stopMusic: ({ game }, action) => game.audio.stopMusic(action.fade),
  changeMusic: ({ game }, action) => game.audio.changeMusic(action.music, action),
  setVolume: ({ game }, action) => game.audio.setVolume(action.channel, action.value, action.asset),
  setSpeed: ({ game }, action) => game.audio.setSpeed(action.channel, action.value, action.asset),
  setPitch: ({ game }, action) => game.audio.setPitch(action.channel, action.semitones, action.asset),
  setAnimationSound: ({ game }, action) => {
    const override = action.sound ? { sound: action.sound } : null; game.animationSoundOverrides.set(action.cue, override);
    const roomId = game.room?.id ?? game.state.currentRoom; game.state.roomState[roomId] ??= {}; game.state.roomState[roomId].animationSoundOverrides ??= {}; game.state.roomState[roomId].animationSoundOverrides[action.cue] = override;
  },
  setAnimationLooping: ({ game }, action) => game.setAnimationLooping(action.animation, action.enabled),
  playFMV: ({ game }, action) => { const completion = game.fmv.play(action.video, action); if (action.blocking === false) { completion.catch((error) => game.handleError(error)); return; } return completion; },
  playScreenAnimation: async ({ game }, action) => {
    const animation = game.project.animations.get(action.animation); if (!animation) throw new Error(`Missing screen animation: ${action.animation}`);
    await game.renderer.preloadAnimation(animation); const duration = Math.max(1, Number(action.duration) || animationDurationMs(animation, 650));
    game.screenAnimations ??= []; game.screenAnimations.push({ ...action, animation, started: performance.now(), duration, soundInstanceId: `screen:${game.nextAnimationSoundInstance++}` });
    if (action.blocking !== false) await game.wait(duration);
  },
  playScreenEffect: async ({ game }, action) => {
    const duration = Math.max(1, Number(action.duration) || 650); game.effects.push({ ...action, started: performance.now(), duration });
    if (action.blocking !== false) await game.wait(duration);
  }
};

function cameraAction(movement, action) { return action.blocking === false ? undefined : movement; }

function resetLayerAnimation(game, layerId) { if (game.resetLayerAnimation) game.resetLayerAnimation(layerId); else game.layerAnimationStarts?.set(layerId, globalThis.performance?.now?.() ?? Date.now()); }
function setLayerVisible(game, action, visible) { const changesState = action.layerState !== undefined; if (changesState) { if (game.setLayerStateOverride) game.setLayerStateOverride(action.layer, action.layerState); else game.layerStateOverrides.set(action.layer, action.layerState); } if (game.setLayerVisibilityOverride) game.setLayerVisibilityOverride(action.layer, visible); else game.layerOverrides.set(action.layer, visible); if (visible || changesState) resetLayerAnimation(game, action.layer); }

async function setCharacterState(game, action) {
  const key = action.character || "player"; const placement = key === "player" ? null : (game.room?.characters ?? []).find((entry, index) => (entry.id ?? `${entry.characterId}:${index}`) === key);
  if (key !== "player" && !placement) throw new Error(`Missing room character placement: ${key}`);
  const characterId = key === "player" ? game.playerCharacterId?.() ?? game.room?.playerCharacter ?? "ren" : placement.characterId; const character = game.project.characters.get(characterId);
  if (!character) throw new Error(`Missing character: ${characterId}`);
  if (action.state && !character.animations?.[action.state]) throw new Error(`Missing character state: ${characterId}.${action.state}`);
  const overrides = game.characterStateOverrides; const hadPrevious = overrides.has(key); const previous = overrides.get(key); const roomId = game.room?.id; const applied = action.state ? { state: action.state, startedAt: globalThis.performance?.now?.() ?? Date.now() } : null;
  if (applied) overrides.set(key, applied); else overrides.delete(key);
  const duration = Math.max(0, Number(action.duration) || 0); if (!duration) return;
  await game.wait(duration);
  const stillCurrent = applied ? overrides.get(key) === applied : !overrides.has(key);
  if (game.room?.id !== roomId || !stillCurrent) return;
  if (hadPrevious) overrides.set(key, previous); else overrides.delete(key);
}

function setCharacterVisible(game, action) {
  const key = action.character || "player";
  if (key !== "player" && !(game.room?.characters ?? []).some((entry, index) => (entry.id ?? `${entry.characterId}:${index}`) === key)) throw new Error(`Missing room character placement: ${key}`);
  game.characterVisibilityOverrides.set(key, action.visible !== false);
}
