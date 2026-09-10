import { resolveAssetUrl } from "../../../shared/js/Assets.js";

const GAME_BASE = new URL("../../", import.meta.url);

export function configureLaunchScreen(project, { documentRef = globalThis.document, assetBase = GAME_BASE } = {}) {
  const screen = documentRef.querySelector("#launch-screen");
  const title = documentRef.querySelector("#launch-title");
  const button = documentRef.querySelector("#launch-button");
  const background = documentRef.querySelector("#launch-background");
  if (!screen || !title || !button || !background) throw new Error("The game launch screen is incomplete.");
  const gameTitle = project?.game?.title || project?.game?.id || "The Moon That Forgot";
  documentRef.title = gameTitle;
  title.textContent = gameTitle;
  button.disabled = false;
  button.textContent = "Play";
  if (project?.game?.launchBackground) {
    background.src = resolveAssetUrl(project.game.launchBackground, assetBase);
    background.classList.remove("hidden");
    background.onerror = () => background.classList.add("hidden");
  } else {
    background.removeAttribute("src");
    background.classList.add("hidden");
  }
  return { screen, title, button, background };
}

export function waitForLaunch(project, { documentRef = globalThis.document, assetBase = GAME_BASE, onLaunch = () => {} } = {}) {
  const elements = configureLaunchScreen(project, { documentRef, assetBase });
  elements.screen.classList.remove("hidden");
  elements.button.focus?.();
  return new Promise((resolve, reject) => {
    elements.button.addEventListener("click", () => {
      elements.button.disabled = true;
      elements.button.textContent = "Starting…";
      let startup;
      try { startup = onLaunch(); }
      catch (error) { reject(error); return; }
      elements.screen.classList.add("hidden");
      Promise.resolve(startup).then(resolve, reject);
    }, { once: true });
  });
}
