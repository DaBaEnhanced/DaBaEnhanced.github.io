import { resolveAssetUrl } from "../../../shared/js/Assets.js";

const LABELS = { walk: "Walk to", look: "Look at", use: "Use", talk: "Talk to", pickUp: "Pick up" };
const GAME_BASE = new URL("../../", import.meta.url);
const normalizeSpeaker = (value) => String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

export function findSpeakerCharacter(characters, speaker, playerCharacterId = null) {
  if (!speaker || !characters) return null;
  const normalized = normalizeSpeaker(speaker);
  const player = playerCharacterId ? characters.get?.(playerCharacterId) : null;
  const defaultPlayer = characters.get?.("ren");
  const playerAlias = normalized === "player" || Boolean(
    defaultPlayer && [defaultPlayer.id, defaultPlayer.name].some((value) => normalizeSpeaker(value) === normalized),
  );
  if (player && playerAlias) return player;
  const direct = characters.get?.(speaker); if (direct) return direct;
  return [...characters.values()].find((character) => normalizeSpeaker(character.id) === normalized || normalizeSpeaker(character.name) === normalized) ?? null;
}

export class GameUI {
  constructor(game) {
    this.game = game;
    this.speech = document.querySelector("#speech");
    this.speaker = document.querySelector("#speaker");
    this.speakerPortrait = document.querySelector("#speaker-portrait");
    this.speechText = document.querySelector("#speech-text");
    this.continueHint = document.querySelector("#continue-hint");
    this.choices = document.querySelector("#choices");
    this.status = document.querySelector("#status-line");
    this.inventory = document.querySelector("#inventory");
    this.toastElement = document.querySelector("#toast");
    this.toastTimer = null;
  }

  bind() {
    document.querySelector("#verbs").addEventListener("click", (event) => {
      const verb = event.target.closest("button")?.dataset.verb;
      if (verb) this.game.setVerb(verb);
    });
    this.speech.addEventListener("click", (event) => { if (!event.target.closest("#choices button")) this.game.dialogue.advance(); });
    document.querySelector("#save-button").addEventListener("click", () => this.game.save.write());
    document.querySelector("#load-button").addEventListener("click", () => this.game.save.loadPreferred());
    const help = document.querySelector("#help");
    document.querySelector("#help-button").addEventListener("click", () => help.classList.remove("hidden"));
    document.querySelector("#close-help").addEventListener("click", () => help.classList.add("hidden"));
  }

  setVerb(verb) {
    document.querySelectorAll("[data-verb]").forEach((button) => button.classList.toggle("active", button.dataset.verb === verb));
    this.updateStatus();
  }

  updateStatus(target = this.game.hovered) {
    const item = this.game.selectedItem ? this.game.project.items.get(this.game.selectedItem) : null;
    const targetName = target?.name ?? "…";
    this.status.textContent = item ? `Use ${item.name} with ${targetName}` : `${LABELS[this.game.verb]} ${targetName}`;
  }

  showSpeech(speaker, text) {
    const character = findSpeakerCharacter(this.game.project.characters, speaker, this.game.playerCharacterId?.() ?? this.game.room?.playerCharacter);
    this.speaker.textContent = character?.name ?? speaker;
    this.speaker.classList.toggle("hidden", !speaker);
    const portrait = character?.portrait;
    this.speakerPortrait.classList.toggle("hidden", !portrait);
    this.speech.classList.toggle("has-portrait", Boolean(portrait));
    if (portrait) { this.speakerPortrait.src = resolveAssetUrl(portrait, GAME_BASE); this.speakerPortrait.alt = character?.name ? `${character.name} portrait` : "Speaker portrait"; this.speakerPortrait.onerror = () => { this.speakerPortrait.classList.add("hidden"); this.speech.classList.remove("has-portrait"); }; }
    else { this.speakerPortrait.removeAttribute("src"); this.speakerPortrait.alt = ""; }
    this.speechText.textContent = text;
    this.speechText.classList.remove("hidden"); this.continueHint.classList.remove("hidden"); this.speech.classList.remove("choices-only"); this.choices.classList.add("hidden");
    this.speech.classList.remove("hidden");
  }
  hideSpeech() { this.speech.classList.add("hidden"); this.speech.classList.remove("choices-only"); this.choices.classList.add("hidden"); }

  choose(choices, { retainSpeech = false } = {}) {
    this.choices.replaceChildren();
    if (!retainSpeech) { this.speaker.classList.add("hidden"); this.speakerPortrait.classList.add("hidden"); this.speech.classList.remove("has-portrait"); this.speechText.classList.add("hidden"); this.speech.classList.add("choices-only"); }
    this.continueHint.classList.add("hidden"); this.choices.classList.remove("hidden"); this.speech.classList.remove("hidden");
    return new Promise((resolve) => {
      for (const choice of choices) {
        const button = document.createElement("button");
        button.textContent = choice.text;
        button.addEventListener("click", (event) => { event.stopPropagation(); this.hideSpeech(); resolve(choice); }, { once: true });
        this.choices.append(button);
      }
    });
  }

  renderInventory() {
    this.inventory.replaceChildren();
    if (!this.game.state.inventory.length) {
      const empty = document.createElement("span"); empty.textContent = "Inventory empty"; empty.style.color = "#667784"; this.inventory.append(empty); return;
    }
    for (const itemId of this.game.state.inventory) {
      const item = this.game.project.items.get(itemId);
      const button = document.createElement("button");
      button.className = "inventory-item"; button.dataset.item = itemId;
      if (item?.icon) { const image = document.createElement("img"); image.src = resolveAssetUrl(item.icon, GAME_BASE); image.alt = ""; button.append(image); }
      const label = document.createElement("span"); label.textContent = item?.name ?? itemId; button.append(label);
      button.classList.toggle("active", this.game.selectedItem === itemId);
      button.addEventListener("click", () => this.game.selectItem(itemId));
      button.addEventListener("contextmenu", (event) => { event.preventDefault(); this.game.actions.run(item?.interactions?.look ?? []); });
      this.inventory.append(button);
    }
  }

  toast(text) {
    clearTimeout(this.toastTimer); this.toastElement.textContent = text; this.toastElement.classList.add("visible");
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove("visible"), 1800);
  }
}
