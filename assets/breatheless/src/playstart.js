/** Forward the shell's trusted start gesture to the canvas as a complete
 * activation. Both events are dispatched synchronously while browser user
 * activation is still live, so the game's audio wake handler can resume its
 * AudioContext without leaving a gameplay button held. */
export function forwardStartGesture(target, Pointer = globalThis.PointerEvent) {
  if (!target || !Pointer) return false;
  const init = { bubbles: true, pointerType: 'mouse', pointerId: 1, button: 0 };
  target.dispatchEvent(new Pointer('pointerdown', init));
  target.dispatchEvent(new Pointer('pointerup', init));
  return true;
}
