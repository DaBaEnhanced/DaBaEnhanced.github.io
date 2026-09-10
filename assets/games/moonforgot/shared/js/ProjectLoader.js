export class ProjectLoader {
  constructor(baseUrl = "../project/") {
    this.baseUrl = new URL(baseUrl, globalThis.document?.baseURI ?? import.meta.url);
  }

  async json(path) {
    const response = await fetch(new URL(path, this.baseUrl));
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.json();
  }

  async load() {
    const manifest = await this.json("project.json");
    const loadEntries = async (paths = []) => Promise.all(paths.map((path) => this.json(path)));
    const [rooms, closeups, characters, items, dialogues, cutscenes, animationData, soundData, musicData, videoData] = await Promise.all([
      loadEntries(manifest.rooms), loadEntries(manifest.closeups), loadEntries(manifest.characters), loadEntries(manifest.items),
      loadEntries(manifest.dialogues), loadEntries(manifest.cutscenes), manifest.animations ? this.json(manifest.animations) : [], manifest.sounds ? this.json(manifest.sounds) : [], manifest.music ? this.json(manifest.music) : [], manifest.videos ? this.json(manifest.videos) : []
    ]);
    const animations = Array.isArray(animationData) ? animationData : Object.entries(animationData).map(([id, value]) => ({ id, ...value }));
    const sounds = Array.isArray(soundData) ? soundData : Object.entries(soundData).map(([id, value]) => ({ id, ...value }));
    const music = Array.isArray(musicData) ? musicData : Object.entries(musicData).map(([id, value]) => ({ id, ...value }));
    const videos = Array.isArray(videoData) ? videoData : Object.entries(videoData).map(([id, value]) => ({ id, ...value }));
    return {
      ...manifest,
      rooms: new Map(rooms.map((entry) => [entry.id, entry])),
      closeups: new Map(closeups.map((entry) => [entry.id, entry])),
      characters: new Map(characters.map((entry) => [entry.id, entry])),
      items: new Map(items.map((entry) => [entry.id, entry])),
      dialogues: new Map(dialogues.map((entry) => [entry.id, entry])),
      cutscenes: new Map(cutscenes.map((entry) => [entry.id, entry])),
      animations: new Map(animations.map((entry) => [entry.id, entry])),
      sounds: new Map(sounds.map((entry) => [entry.id, entry])),
      music: new Map(music.map((entry) => [entry.id, entry])),
      videos: new Map(videos.map((entry) => [entry.id, entry]))
    };
  }
}
