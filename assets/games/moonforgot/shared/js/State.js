import { scaleAtPosition } from "./Navigation.js";

export const SAVE_VERSION = 1;

export function createInitialState(project, room) {
  const configured = project.initialState ?? {};
  return {
    saveVersion: SAVE_VERSION,
    currentRoom: project.game.startRoom,
    player: {
      x: project.game.startPosition?.x ?? room.playerStart?.x ?? 160,
      y: project.game.startPosition?.y ?? room.playerStart?.y ?? 130,
      facing: project.game.startPosition?.facing ?? room.playerStart?.facing ?? "right",
      scale: scaleAtPosition(room.navNodes, project.game.startPosition ?? room.playerStart, room.playerStart?.scale ?? 1)
    },
    inventory: [...(configured.inventory ?? [])],
    flags: { ...(configured.flags ?? {}) },
    vars: { ...(configured.vars ?? {}) },
    roomState: structuredClone(configured.roomState ?? {}),
    closeupState: structuredClone(configured.closeupState ?? {}),
    dialogueState: structuredClone(configured.dialogueState ?? {}),
    visitedRooms: [],
    playTimeSeconds: 0,
    settings: {
      textSpeed: 24,
      subtitleScale: 1,
      hotspotAssist: false,
      reducedMotion: false,
      ...(configured.settings ?? {})
    }
  };
}

export function normalizeState(state) {
  return {
    ...state,
    saveVersion: SAVE_VERSION,
    player: { ...(state.player ?? {}) },
    inventory: [...(state.inventory ?? [])],
    flags: { ...(state.flags ?? {}) },
    vars: { ...(state.vars ?? {}) },
    roomState: structuredClone(state.roomState ?? {}),
    closeupState: structuredClone(state.closeupState ?? {}),
    dialogueState: structuredClone(state.dialogueState ?? {}),
    visitedRooms: [...(state.visitedRooms ?? [])]
  };
}
