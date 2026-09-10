import { availableDialogueChoices, dialogueNodeHasSpeech, resolveDialogueNodeDestination } from "../../../shared/js/DialogueBranches.js";

export class DialogueSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.inConversation = false;
    this.resolveSpeech = null;
    this.conversationDepth = 0;
    this.startQueue = Promise.resolve();
  }

  say(speaker, text) {
    this.active = true;
    this.game.ui.showSpeech(speaker, text);
    return new Promise((resolve) => { this.resolveSpeech = resolve; });
  }

  advance() {
    if (!this.resolveSpeech) return false;
    this.game.ui.hideSpeech();
    const resolve = this.resolveSpeech;
    this.resolveSpeech = null;
    if (!this.inConversation) this.active = false;
    resolve();
    return true;
  }

  start(dialogueId, context = {}) {
    // Dialogue actions are re-entrant; unrelated room/hotspot/periodic requests are serialized.
    if (context?.dialogueId && this.inConversation) return this.runConversation(dialogueId);
    const queued = this.startQueue.then(() => this.runConversation(dialogueId));
    this.startQueue = queued.catch(() => {});
    return queued;
  }

  async runConversation(dialogueId) {
    const dialogue = this.game.project.dialogues.get(dialogueId);
    if (!dialogue) throw new Error(`Missing dialogue: ${dialogueId}`);
    this.conversationDepth++; this.active = true; this.inConversation = true;
    this.game.inputEnabled = false;
    this.game.events.emit("dialogue:started", { dialogueId });
    try {
      let nodeId = dialogue.start;
      while (nodeId) {
        const node = dialogue.nodes[nodeId];
        if (!node) throw new Error(`Broken dialogue link: ${dialogueId}.${nodeId}`);
        const hasSpeech = dialogueNodeHasSpeech(node); const combinesPromptAndChoices = hasSpeech && Array.isArray(node.choices);
        if (hasSpeech) { if (combinesPromptAndChoices) this.game.ui.showSpeech(node.speaker ?? "", node.text ?? ""); else await this.say(node.speaker ?? "", node.text ?? ""); }
        if (node.actions) await this.game.actions.run(node.actions, { dialogueId, nodeId });
        if (node.choices) {
          const used = this.game.state.dialogueState[dialogueId]?.usedChoices ?? [];
          const choices = availableDialogueChoices(node, this.game.state, used, { dialogueId, nodeId });
          if (!choices.length) { if (combinesPromptAndChoices) this.game.ui.hideSpeech?.(); break; }
          const choice = await this.game.ui.choose(choices, { retainSpeech: combinesPromptAndChoices });
          if (!choice) break;
          if (choice.once) {
            this.game.state.dialogueState[dialogueId] ??= { usedChoices: [] };
            this.game.state.dialogueState[dialogueId].usedChoices.push(choice.id);
          }
          if (choice.actions) await this.game.actions.run(choice.actions, { dialogueId, choiceId: choice.id });
          if (choice.end) break;
          nodeId = choice.next;
          continue;
        }
        nodeId = resolveDialogueNodeDestination(node, this.game.state, { dialogueId, nodeId });
      }
    } finally {
      this.conversationDepth = Math.max(0, this.conversationDepth - 1); this.inConversation = this.conversationDepth > 0;
      this.game.events.emit("dialogue:ended", { dialogueId });
      if (!this.inConversation) { this.active = false; this.game.ui.hideSpeech?.(); this.game.inputEnabled = true; }
    }
    await this.game.save.autosave();
  }
}
