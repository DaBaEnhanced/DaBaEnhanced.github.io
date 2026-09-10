import { ProjectLoader } from "../../shared/js/ProjectLoader.js";
import { hydrateProjectBundle, projectBundleFromPayload } from "../../shared/js/ProjectBundle.js";
import { Game } from "./core/Game.js";
import { configurePreviewRoom } from "./core/PreviewLaunch.js";
import { waitForLaunch } from "./ui/LaunchScreen.js";

try {
  const parameters = new URLSearchParams(location.search);
  let project;
  if (parameters.has("bundle")) {
    const response = await fetch(new URL(parameters.get("bundle"), document.baseURI)); if (!response.ok) throw new Error(`Could not load game bundle: ${response.status}`);
    project = hydrateProjectBundle(projectBundleFromPayload(await response.json()));
  } else if (parameters.has("preview")) {
    const { EditorStorage } = await import("../../editor/js/core/EditorStorage.js");
    const storage = new EditorStorage(); const previewKey = parameters.get("previewKey") || "working"; const workingCopy = await storage.get(previewKey);
    const bundle = workingCopy?.bundle ?? JSON.parse(sessionStorage.getItem("moon-editor-preview") ?? "null");
    if (!bundle) throw new Error("Editor preview data is missing. Launch test play from the editor again.");
    project = hydrateProjectBundle(bundle);
  } else project = await new ProjectLoader("../project/").load();
  const requestedRoom = parameters.get("room");
  configurePreviewRoom(project, requestedRoom, parameters.get("player"));
  const game = new Game(project, document.querySelector("#game-canvas"));
  globalThis.game = game;
  await game.prepare();
  await waitForLaunch(project, { onLaunch: () => { game.unlockAudio(); return game.begin(); } });
} catch (error) {
  console.error(error);
  document.querySelector("#launch-screen")?.classList.add("hidden");
  const loading = document.querySelector("#loading"); loading.classList.remove("hidden"); loading.textContent = `WAKE FAILURE: ${error.message}`;
}
