import { evaluateCondition } from "../../../shared/js/ConditionEvaluator.js";
import { animationFrameIndex, animationFrameSource, resolveAssetUrl } from "../../../shared/js/Assets.js";
import { characterSpriteMetrics, characterStateName, resolveCharacterState } from "../../../shared/js/Characters.js";
import { depthAtPosition, navigationSegments, nodeDepth, nodeRadius, scaleAtPosition } from "../../../shared/js/Navigation.js";
import { layerStartsVisible, resolveLayerState } from "../../../shared/js/Layers.js";
import { drawPixelCircle, drawPixelLine, drawPixelPolyline, drawPixelRectangle, drawPixelShape } from "../../../shared/js/PixelGuides.js";
import { bitmapTextWidth, drawBitmapText } from "./BitmapText.js";
import { drawScreenEffect, screenEffectOffset } from "../../../shared/js/ScreenEffects.js";
import { drawCharacterShadow } from "../../../shared/js/CharacterShadow.js";
import { roomWorldSize } from "../../../shared/js/RoomCamera.js";
import { depthSortedSceneItems } from "../../../shared/js/SceneDepth.js";
import { drawLightOverlay } from "../../../shared/js/LightOverlay.js";
import { drawFittedImage } from "../../../shared/js/ImageFit.js";

export function layerAnimationTime(game, layerId, time) { const startedAt = game.layerAnimationStarts?.get(layerId) ?? game.roomAnimationStartedAt ?? 0; return Math.max(0, time - startedAt); }
export function characterAnimationTime(override, time) { return override?.startedAt === undefined ? time : Math.max(0, time - override.startedAt); }
export class Renderer {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.images = new Map();
    this.characterMovementClocks = new Map();
    this.assetBase = new URL("../../", import.meta.url);
    this.lastTime = performance.now();
  }

  async loadImage(src) {
    const key = String(src);
    if (!this.images.has(key)) this.images.set(key, new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { console.warn(`Could not load image: ${src}`); resolve(null); }; image.src = src;
    }));
    const pending = this.images.get(key); const image = pending instanceof Promise ? await pending : pending;
    this.images.set(key, image);
    return image;
  }

  async preloadRoom(room) {
    const paths = [room.background];
    for (const layer of room.layers ?? []) {
      const specifications = Object.keys(layer.states ?? {}).length ? Object.values(layer.states) : [layer];
      for (const specification of specifications) {
        if (specification.type === "animation" || specification.animation) {
          const animation = this.game.project.animations?.get(specification.animation);
          paths.push(...(animation?.frames ?? []).map(animationFrameSource));
        } else paths.push(specification.src);
      }
    }
    const characterIds = [this.game.playerCharacterId(room), ...(room.characters ?? []).map((entry) => entry.characterId)];
    for (const characterId of characterIds) {
      const character = this.game.project.characters.get(characterId);
      for (const state of Object.values(character?.animations ?? {})) {
        if (!state.animation) continue;
        const animation = this.game.project.animations?.get(state.animation);
        paths.push(...(animation?.frames ?? []).map(animationFrameSource));
      }
    }
    await Promise.all(paths.filter(Boolean).map((src) => this.loadImage(resolveAssetUrl(src, this.assetBase))));
  }

  async preloadCharacter(character) {
    const paths = []; for (const state of Object.values(character?.animations ?? {})) { if (!state.animation) continue; const animation = this.game.project.animations?.get(state.animation); paths.push(...(animation?.frames ?? []).map(animationFrameSource)); }
    await Promise.all(paths.filter(Boolean).map((src) => this.loadImage(resolveAssetUrl(src, this.assetBase))));
  }

  resetCharacterPlayback(key) { this.characterMovementClocks.delete(key); }

  async preloadCloseup(closeup) {
    const paths = [closeup.background];
    for (const layer of closeup.layers ?? []) {
      const specifications = Object.keys(layer.states ?? {}).length ? Object.values(layer.states) : [layer];
      for (const specification of specifications) {
        if (specification.type === "animation" || specification.animation) { const animation = this.game.project.animations?.get(specification.animation); paths.push(...(animation?.frames ?? []).map(animationFrameSource)); }
        else paths.push(specification.src);
      }
    }
    await Promise.all(paths.filter(Boolean).map((src) => this.loadImage(resolveAssetUrl(src, this.assetBase))));
  }

  async preloadAnimation(animation) {
    await Promise.all((animation?.frames ?? []).map(animationFrameSource).filter(Boolean).map((src) => this.loadImage(resolveAssetUrl(src, this.assetBase))));
  }

  start() {
    const frame = (time) => { this.draw(time); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  layerVisible(layer) {
    const override = this.game.layerVisibilityOverride ? this.game.layerVisibilityOverride(layer.id) : this.game.layerOverrides?.get(layer.id); if (override !== undefined) return override;
    return layerStartsVisible(layer) && evaluateCondition(layer.visibleIf, this.game.state);
  }

  draw(time) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.game.width, this.game.height);
    const room = this.game.room; const scene = this.game.closeup ?? room;
    if (!scene) return;
    this.game.effects = this.game.effects.filter((effect) => time - effect.started < effect.duration);
    const offset = screenEffectOffset(this.game.effects, time, this.game.width, this.game.height); const camera = this.game.closeup ? { x: 0, y: 0 } : this.game.camera ?? { x: 0, y: 0 }; const world = this.game.closeup ? { width: this.game.width, height: this.game.height } : roomWorldSize(room, { width: this.game.width, height: this.game.height }); ctx.save(); ctx.translate(offset.x - camera.x, offset.y - camera.y);
    const drawImage = (src, layer = {}, alpha = 1) => {
      const cached = this.images.get(resolveAssetUrl(src, this.assetBase));
      if (!isDrawableImage(cached)) return;
      const x = layer.x ?? 0; const y = layer.y ?? 0;
      const width = layer.width ?? (layer.src === scene.background ? world.width : cached.width);
      const height = layer.height ?? (layer.src === scene.background ? world.height : cached.height);
      ctx.save(); ctx.globalAlpha = alpha * (layer.opacity ?? 1); ctx.drawImage(cached, x, y, width, height); ctx.restore();
    };
    const drawLayer = (layer) => {
      const { specification } = resolveLayerState(layer, this.game.layerStateOverride ? this.game.layerStateOverride(layer.id) : this.game.layerStateOverrides?.get(layer.id));
      let source = specification.src;
      if (specification.type === "animation" || specification.animation) {
        const animation = this.game.project.animations?.get(specification.animation);
        const startedAt = this.game.layerAnimationStarts?.get(layer.id) ?? this.game.roomAnimationStartedAt ?? 0;
        const index = animationFrameIndex(animation, layerAnimationTime(this.game, layer.id, time), this.game.animationLoopPlayback?.(animation?.id, startedAt));
        this.game.animationSounds.update(this.game.layerAnimationSoundKey(layer.id), animation, index);
        source = index >= 0 ? animationFrameSource(animation.frames[index]) : null;
      }
      if (specification.type === "light") drawLightOverlay(ctx, specification, layerAnimationTime(this.game, layer.id, time));
      else if (source) drawImage(source, specification, specification.pulse ? .62 + Math.sin(time / 330) * .22 : 1);
    };
    if (this.game.closeup) {
      const background = this.images.get(resolveAssetUrl(scene.background, this.assetBase));
      if (isDrawableImage(background)) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.game.width, this.game.height); ctx.clip(); drawFittedImage(ctx, background, { x: 0, y: 0, width: this.game.width, height: this.game.height }, scene); ctx.restore(); }
    } else drawImage(scene.background, { src: scene.background });
    const layers = (scene.layers ?? []).filter((layer) => this.layerVisible(layer)); const people = this.game.closeup ? [] : this.sceneCharacters();
    for (const item of depthSortedSceneItems(layers, people, this.game.closeup ? [] : room.navNodes)) {
      if (item.kind === "layer") drawLayer(item.value); else this.drawCharacter(item.value, time);
    }
    ctx.restore();
    this.drawScreenAnimations(time);
    this.game.fmv?.draw(ctx, this.game.width, this.game.height);
    this.drawScreenEffects(time);
    if (this.game.debug || this.game.state.settings.hotspotAssist) this.drawDebug();
    this.lastTime = time;
  }

  sceneCharacters() {
    const { game } = this;
    return [{ characterId: game.playerCharacterId(), placementKey: "player", x: game.state.player.x, y: game.state.player.y, facing: game.state.player.facing, scale: game.state.player.scale }, ...(game.room.characters ?? []).map((placement, index) => { const placementKey = game.roomCharacterKey(placement, index); return { ...placement, ...game.npcStates.get(placementKey), placementKey }; })]
      .filter((entry) => game.characterVisibilityOverrides.get(entry.placementKey) ?? evaluateCondition(entry.visibleIf, game.state));
  }

  drawCharacters(time, people = this.sceneCharacters()) {
    for (const person of [...people].sort((left, right) => depthAtPosition(this.game.room.navNodes, left) - depthAtPosition(this.game.room.navNodes, right) || (left.y ?? 0) - (right.y ?? 0))) this.drawCharacter(person, time);
  }

  drawCharacter(person, time) {
    const { ctx, game } = this;
    const character = game.project.characters.get(person.characterId);
    const fallbackScale = .68 + Math.max(0, Math.min(1, (person.y / game.height - 75 / 180) / (100 / 180)) * .32);
    const scale = scaleAtPosition(game.room.navNodes, person, fallbackScale) * (character?.defaultScale ?? 1);
    drawCharacterShadow(ctx, character, person, scale);
    ctx.save(); ctx.translate(person.x, person.y); ctx.scale(scale, scale);
    const moving = person.placementKey === "player" ? game.walkPath.length > 0 : Boolean(person.moving);
    const override = game.characterStateOverrides.get(person.placementKey); const requestedState = moving ? characterStateName(true, person.facing) : override?.state ?? override ?? characterStateName(false, person.facing); const soundInstanceId = `character:${person.placementKey}`; let stateTime; let stateStartedAt;
    if (moving) { const clock = this.characterMovementClocks.get(person.placementKey); if (clock?.state !== requestedState) { this.characterMovementClocks.set(person.placementKey, { state: requestedState, startedAt: time }); game.animationSounds.reset(soundInstanceId); } stateStartedAt = this.characterMovementClocks.get(person.placementKey).startedAt; stateTime = Math.max(0, time - stateStartedAt); }
    else { this.characterMovementClocks.delete(person.placementKey); stateStartedAt = override?.startedAt ?? 0; stateTime = characterAnimationTime(override, time); }
    const rendered = this.drawCharacterFrame(ctx, character, requestedState, stateTime, soundInstanceId, stateStartedAt);
    if (!rendered) { ctx.save(); ctx.scale(game.width / 320, game.height / 180); if (person.characterId === "m7") this.drawM7(ctx, time, person.facing, moving); else if (person.characterId === "ren") this.drawRen(ctx, time, person.facing, moving); else this.drawCharacterPlaceholder(ctx, character); ctx.restore(); }
    ctx.restore();
  }

  drawCharacterPlaceholder(ctx, character) {
    const { width, height, anchor } = characterSpriteMetrics(character); ctx.save(); ctx.fillStyle = "#304e58"; ctx.fillRect(-anchor.x, -anchor.y, width, height); ctx.strokeStyle = "#8ec7c4"; ctx.strokeRect(-anchor.x + .5, -anchor.y + .5, Math.max(0, width - 1), Math.max(0, height - 1)); ctx.restore();
  }

  drawCharacterFrame(ctx, character, stateName, time, soundInstanceId = `character:${character?.id ?? "unknown"}`, startedAt = 0) {
    const resolved = resolveCharacterState(character, stateName); if (!resolved?.specification.animation) { this.game.animationSounds.reset(soundInstanceId); return false; }
    const animation = this.game.project.animations?.get(resolved.specification.animation); const index = animationFrameIndex(animation, time, this.game.animationLoopPlayback?.(animation?.id, startedAt)); this.game.animationSounds.update(soundInstanceId, animation, index);
    if (index < 0) return false; const source = animationFrameSource(animation.frames[index]); const image = this.images.get(resolveAssetUrl(source, this.assetBase)); if (!isDrawableImage(image)) return false;
    const { width, height, anchor } = characterSpriteMetrics(character);
    ctx.save(); if (resolved.mirrored) ctx.scale(-1, 1); ctx.drawImage(image, -anchor.x, -anchor.y, width, height); ctx.restore(); return true;
  }

  drawRen(ctx, time, facing, walking) {
    const step = walking ? Math.sin(time / 70) * 2 : 0;
    ctx.scale(facing === "left" ? -1 : 1, 1);
    ctx.fillStyle = "#1b1723"; ctx.fillRect(-5, -27, 10, 13);
    ctx.fillStyle = "#c18f75"; ctx.fillRect(-4, -35, 8, 8);
    ctx.fillStyle = "#d6b16f"; ctx.fillRect(-5, -37, 8, 3);
    ctx.fillStyle = "#526b72"; ctx.fillRect(-6, -15, 12, 15);
    ctx.fillStyle = "#283941"; ctx.fillRect(-5 + step, 0, 4, 12); ctx.fillRect(1 - step, 0, 4, 12);
    ctx.fillStyle = "#b8d1c7"; ctx.fillRect(2, -32, 2, 2);
  }

  drawM7(ctx, time, facing, moving = false) {
    const twitch = Math.sin(time / 430) > .94 ? 2 : 0; const step = moving ? Math.sin(time / 85) * 3 : 0;
    ctx.scale(facing === "right" ? -1 : 1, 1);
    ctx.fillStyle = "#56646a"; ctx.fillRect(-8, -34 + twitch, 15, 9);
    ctx.fillStyle = "#b86d3c"; ctx.fillRect(3, -32 + twitch, 3, 3);
    ctx.fillStyle = "#35434a"; ctx.fillRect(-7, -24, 13, 18);
    ctx.fillStyle = "#82918b"; ctx.fillRect(-4, -21, 7, 8);
    ctx.strokeStyle = "#687a80"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-7 + step, 10); ctx.moveTo(4, -6); ctx.lineTo(7 - step, 7); ctx.lineTo(10 - step, 11); ctx.stroke();
    ctx.fillStyle = "#d89b4a"; ctx.fillRect(-2, -18, 3, 3);
  }

  drawScreenAnimations(time) {
    const { ctx, game } = this; game.screenAnimations = (game.screenAnimations ?? []).filter((entry) => { const active = time - entry.started < entry.duration; if (!active) game.animationSounds.reset(entry.soundInstanceId); return active; });
    for (const entry of game.screenAnimations) {
      const elapsed = Math.max(0, time - entry.started); const animation = { ...entry.animation, loop: entry.loop === true }; const index = animationFrameIndex(animation, elapsed, game.animationLoopPlayback?.(entry.animation.id, entry.started)); if (index < 0) continue;
      game.animationSounds.update(entry.soundInstanceId, animation, index); const source = animationFrameSource(animation.frames[index]); const image = this.images.get(resolveAssetUrl(source, this.assetBase)); if (!isDrawableImage(image)) continue;
      const target = { x: entry.x ?? 0, y: entry.y ?? 0, width: entry.width ?? game.width, height: entry.height ?? game.height }; let x = target.x; let y = target.y; let width = target.width; let height = target.height;
      if (entry.fit !== "stretch") { const ratio = entry.fit === "cover" ? Math.max(target.width / image.width, target.height / image.height) : Math.min(target.width / image.width, target.height / image.height); width = image.width * ratio; height = image.height * ratio; x += (target.width - width) / 2; y += (target.height - height) / 2; }
      ctx.save(); ctx.globalAlpha = entry.opacity ?? 1; ctx.drawImage(image, x, y, width, height); ctx.restore();
    }
  }

  drawScreenEffects(time) {
    const { ctx, game } = this;
    for (const effect of game.effects) drawScreenEffect(ctx, this.canvas, effect, time, game.width, game.height);
  }

  drawDebug() {
    const { ctx, game } = this;
    ctx.save(); ctx.translate(game.closeup ? 0 : -(game.camera?.x ?? 0), game.closeup ? 0 : -(game.camera?.y ?? 0));
    for (const hotspot of game.activeHotspots()) {
      const color = game.hovered?.id === hotspot.id ? "#fff58a" : "#72ffd3"; ctx.fillStyle = "#58e6b020";
      ctx.beginPath();
      if (hotspot.shape.type === "polygon") hotspot.shape.points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      else if (hotspot.shape.type === "circle") ctx.arc(hotspot.shape.x, hotspot.shape.y, hotspot.shape.radius, 0, Math.PI * 2);
      else ctx.rect(hotspot.shape.x, hotspot.shape.y, hotspot.shape.width, hotspot.shape.height);
      ctx.closePath(); ctx.fill(); drawPixelShape(ctx, hotspot.shape, color);
    }
    if (game.debug) {
      const textScale = Math.max(1, Math.round(game.width / 320));
      const nodes = game.closeup ? [] : game.room.navNodes ?? []; const segments = navigationSegments(nodes);
      ctx.save(); ctx.globalAlpha = .32;
      for (const { a, b, length } of segments) { const ar = nodeRadius(a); const br = nodeRadius(b); const nx = length ? -(b.y - a.y) / length : 0; const ny = length ? (b.x - a.x) / length : 1; drawPixelPolyline(ctx, [[a.x + nx * ar, a.y + ny * ar], [b.x + nx * br, b.y + ny * br], [b.x - nx * br, b.y - ny * br], [a.x - nx * ar, a.y - ny * ar]], "#f2a6ff", true); }
      for (const node of nodes) drawPixelCircle(ctx, node.x, node.y, nodeRadius(node), "#f2a6ff"); ctx.restore();
      for (const { a, b } of segments) drawPixelLine(ctx, a.x, a.y, b.x, b.y, "#f2a6ff");
      for (const node of nodes) { drawPixelRectangle(ctx, { x: node.x - 1, y: node.y - 1, width: 2, height: 2 }, "#f7c0ff"); drawBitmapText(ctx, `${Math.round((node.scale ?? 1) * 100)}% D${Math.round(nodeDepth(node))}`, node.x + 3, node.y - 7 * textScale, { color: "#ffd1ff", shadow: "#210526", scale: textScale, maxWidth: (game.camera?.x ?? 0) + game.width - node.x - 4 }); }
    }
    ctx.restore();
    if (game.debug) { const textScale = Math.max(1, Math.round(game.width / 320)); const roomLine = `ROOM ${game.room.id} @ ${Math.round(game.state.player.x)},${Math.round(game.state.player.y)} D${Math.round(depthAtPosition(game.room.navNodes, game.state.player))} CAM ${Math.round(game.camera?.x ?? 0)},${Math.round(game.camera?.y ?? 0)}`; const verbLine = `VERB ${game.verb} ITEM ${game.selectedItem ?? "-"}`; const musicLine = game.audio.musicDebugStatus(); const fmvLine = game.fmv.debugStatus(); const lines = [roomLine, verbLine, musicLine, fmvLine]; const panelWidth = Math.min(game.width - 6, Math.max(...lines.map((line) => bitmapTextWidth(line, textScale))) + 7 * textScale); const panelHeight = 4 + 27 * textScale; ctx.fillStyle = "#020609ed"; ctx.fillRect(3, 3, panelWidth, panelHeight); drawPixelRectangle(ctx, { x: 3, y: 3, width: panelWidth - 1, height: panelHeight - 1 }, "#86aaa6"); drawBitmapText(ctx, roomLine, 6, 6, { color: "#eaffea", shadow: "#00100b", scale: textScale, maxWidth: panelWidth - 6 }); drawBitmapText(ctx, verbLine, 6, 6 + 7 * textScale, { color: "#ffe18b", shadow: "#140d00", scale: textScale, maxWidth: panelWidth - 6 }); drawBitmapText(ctx, musicLine, 6, 6 + 14 * textScale, { color: "#9fdcff", shadow: "#001018", scale: textScale, maxWidth: panelWidth - 6 }); drawBitmapText(ctx, fmvLine, 6, 6 + 21 * textScale, { color: "#ffb6de", shadow: "#18000c", scale: textScale, maxWidth: panelWidth - 6 }); }
  }
}

export function isDrawableImage(value) { return Boolean(value && !(value instanceof Promise) && Number.isFinite(value.width) && Number.isFinite(value.height)); }
