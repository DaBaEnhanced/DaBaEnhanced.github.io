import { decodePassword, encodePassword } from './frontend.js';

export const CAMPAIGN_SAVE_KEY = 'alien-breed-3d-retail-password-v1';
export const GAMEPAD_BUTTONS = Object.freeze({
  confirm: 0, back: 1, duck: 1, operate: 2, previousWeapon: 4, nextWeapon: 5,
  run: 6, fire: 7, menu: 8, pause: 9, up: 12, down: 13, left: 14, right: 15,
});

function buttonDown(button) {
  return Boolean(button && (button.pressed || button.value >= .5));
}

export function readGamepad(gamepads, previousButtons = new Set()) {
  const gamepad = Array.from(gamepads || []).find(candidate => candidate?.connected !== false);
  if (!gamepad) {
    return {
      connected: false, forward: 0, sideways: 0, turning: 0, fire: false, running: false,
      buttons: new Set(), pressed: new Set(),
    };
  }
  const buttons = new Set();
  gamepad.buttons.forEach((button, index) => { if (buttonDown(button)) buttons.add(index); });
  const pressed = new Set([...buttons].filter(index => !previousButtons.has(index)));
  // cd32joy:.GameCtrl writes only the digital JPF_JOY_* directions into
  // KeyMap: up/down are forward/back and left/right are turn. In particular,
  // it has no analog-axis or direct-strafe mapping. Ignoring browser analog
  // axes also prevents an uncentred stick from inventing continuous motion.
  return {
    connected: true,
    forward: Number(buttons.has(GAMEPAD_BUTTONS.up))
      - Number(buttons.has(GAMEPAD_BUTTONS.down)),
    sideways: 0,
    turning: Number(buttons.has(GAMEPAD_BUTTONS.right))
      - Number(buttons.has(GAMEPAD_BUTTONS.left)),
    fire: buttons.has(GAMEPAD_BUTTONS.confirm) || buttons.has(GAMEPAD_BUTTONS.fire),
    running: buttons.has(GAMEPAD_BUTTONS.run),
    buttons,
    pressed,
  };
}

export function saveCampaign(storage, stats) {
  if (!storage || !stats) return null;
  const password = encodePassword(stats);
  try {
    storage.setItem(CAMPAIGN_SAVE_KEY, password);
    return password;
  } catch {
    return null;
  }
}

export function loadCampaign(storage) {
  if (!storage) return null;
  try {
    return decodePassword(storage.getItem(CAMPAIGN_SAVE_KEY) || '');
  } catch {
    return null;
  }
}
