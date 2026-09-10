export class InventorySystem {
  constructor(game) { this.game = game; }

  add(itemId) {
    if (!this.game.project.items.has(itemId)) throw new Error(`Missing item: ${itemId}`);
    if (!this.game.state.inventory.includes(itemId)) this.game.state.inventory.push(itemId);
    this.game.events.emit("item:added", { itemId });
    this.game.ui.renderInventory();
  }

  remove(itemId) {
    this.game.state.inventory = this.game.state.inventory.filter((id) => id !== itemId);
    if (this.game.selectedItem === itemId) this.game.selectedItem = null;
    this.game.events.emit("item:removed", { itemId });
    this.game.ui.renderInventory();
  }

  async combine(firstId, secondId) {
    const actions = this.game.project.items.get(firstId)?.combineWith?.[secondId]
      ?? this.game.project.items.get(secondId)?.combineWith?.[firstId];
    if (!actions) return this.game.dialogue.say("Ren", "Those two things have nothing useful to say to each other.");
    return this.game.actions.run(actions, { firstId, secondId });
  }
}
