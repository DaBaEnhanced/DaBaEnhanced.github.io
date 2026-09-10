import { normalizeState, SAVE_VERSION } from "../../../shared/js/State.js";

export class SaveSystem {
  constructor(game) { this.game = game; this.database = null; }

  async open() {
    if (!globalThis.indexedDB) return null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("moon-that-forgot", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves", { keyPath: "slot" });
      request.onsuccess = () => { this.database = request.result; resolve(this.database); };
      request.onerror = () => reject(request.error);
    });
  }

  async write(slot = "manual") {
    if (!this.database) await this.open();
    if (!this.database) return;
    const record = { slot, saveVersion: SAVE_VERSION, timestamp: new Date().toISOString(), state: structuredClone(this.game.state) };
    await new Promise((resolve, reject) => {
      const request = this.database.transaction("saves", "readwrite").objectStore("saves").put(record);
      request.onsuccess = resolve; request.onerror = () => reject(request.error);
    });
    this.game.events.emit("save:created", { slot });
    if (slot === "manual") this.game.ui.toast("Memory recorded");
  }

  autosave() { return this.write("autosave"); }

  async read(slot = "manual") {
    if (!this.database) await this.open();
    if (!this.database) return null;
    const record = await new Promise((resolve, reject) => {
      const request = this.database.transaction("saves").objectStore("saves").get(slot);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (!record) return null;
    if (record.saveVersion !== SAVE_VERSION) throw new Error(`Unsupported save version ${record.saveVersion}`);
    return normalizeState(record.state);
  }

  async loadPreferred() {
    const state = await this.read("manual") ?? await this.read("autosave");
    if (!state) { this.game.ui.toast("No recorded memory"); return; }
    this.game.state = state;
    await this.game.changeRoom(state.currentRoom, { x: state.player.x, y: state.player.y, scale: state.player.scale }, state.player.facing, false, true);
    this.game.ui.renderInventory();
    this.game.ui.toast("Memory restored");
  }
}
