const COLLECTIONS = ["rooms", "closeups", "characters", "items", "dialogues", "cutscenes", "animations", "sounds", "music", "videos"];

export function projectBundleFromPayload(payload) {
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch (error) { throw new Error(`Invalid project bundle JSON: ${error.message}`); } }
  const source = payload?.bundle ?? payload; if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Project bundle must contain an object.");
  if (!source.manifest?.game) throw new Error("Project bundle is missing manifest.game.");
  const bundle = { manifest: structuredClone(source.manifest) };
  for (const collection of COLLECTIONS) { if (source[collection] !== undefined && !Array.isArray(source[collection])) throw new Error(`Project bundle '${collection}' must be an array.`); bundle[collection] = structuredClone(source[collection] ?? []); }
  return bundle;
}

export function hydrateProjectBundle(payload) {
  const bundle = projectBundleFromPayload(payload);
  return {
    ...structuredClone(bundle.manifest),
    ...Object.fromEntries(COLLECTIONS.map((collection) => [collection, new Map(bundle[collection].map((entry) => [entry.id, entry]))]))
  };
}

export function serializeProjectBundle(bundle) { return JSON.stringify({ bundleVersion: 1, exportedAt: new Date().toISOString(), ...bundle }, null, 2); }
