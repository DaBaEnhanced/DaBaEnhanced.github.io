export const CONDITION_DEFINITIONS = [
  { kind: "always", label: "Always", detect: (value) => value === true || value === undefined || value === null || value === "true", create: () => true },
  { kind: "never", label: "Never", detect: (value) => value === false || value === "false", create: () => false },
  { kind: "flag", label: "Flag", detect: (value) => Object.hasOwn(value ?? {}, "flag") || typeof value === "string" && /^!?flag\./.test(value), create: () => ({ flag: "", equals: true }), evaluate: (value, api) => api.compare(Boolean(api.state.flags[value.flag]), value) },
  { kind: "variable", label: "Variable", detect: (value) => Object.hasOwn(value ?? {}, "var"), create: () => ({ var: "", equals: 0 }), evaluate: (value, api) => api.compare(api.state.vars[value.var] ?? 0, value) },
  { kind: "inventory", label: "Inventory item", detect: (value) => Object.hasOwn(value ?? {}, "inventoryHas"), create: () => ({ inventoryHas: "" }), evaluate: (value, api) => api.state.inventory.includes(value.inventoryHas) },
  { kind: "roomVariable", label: "Room variable", detect: (value) => Boolean(value?.roomVar), create: () => ({ roomVar: { key: "" }, equals: true }), evaluate: (value, api) => { const room = value.roomVar.room || api.context.room?.id || api.state.currentRoom; return api.compare(api.state.roomState[room]?.[value.roomVar.key], value); } },
  { kind: "all", label: "All conditions", detect: (value) => Array.isArray(value?.all), create: () => ({ all: [] }), evaluate: (value, api) => value.all.every(api.evaluate) },
  { kind: "any", label: "Any condition", detect: (value) => Array.isArray(value?.any), create: () => ({ any: [] }), evaluate: (value, api) => value.any.some(api.evaluate) },
  { kind: "not", label: "Not", detect: (value) => Object.hasOwn(value ?? {}, "not"), create: () => ({ not: true }), evaluate: (value, api) => !api.evaluate(value.not) },
  { kind: "advanced", label: "Advanced path / JSON", detect: (value) => Boolean(value?.path), create: () => ({ path: "flag.example", equals: true }), evaluate: (value, api) => api.compare(api.valueAt(value.path), value) }
];

export const CONDITION_KINDS = CONDITION_DEFINITIONS.map(({ kind, label }) => ({ kind, label }));

export const COMPARATORS = [
  ["equals", "="], ["notEquals", "≠"], ["gt", ">"], ["gte", "≥"], ["lt", "<"], ["lte", "≤"]
];

export function conditionKind(condition) {
  return CONDITION_DEFINITIONS.find((definition) => definition.detect(condition))?.kind ?? "advanced";
}

export function createCondition(kind) {
  return structuredClone(CONDITION_DEFINITIONS.find((definition) => definition.kind === kind)?.create() ?? true);
}

export function comparisonOf(condition) {
  return COMPARATORS.find(([key]) => Object.hasOwn(condition ?? {}, key))?.[0] ?? "equals";
}

export function comparisonValue(condition) { return condition?.[comparisonOf(condition)] ?? true; }

export function withComparison(condition, comparator, value) {
  const next = structuredClone(condition); for (const [key] of COMPARATORS) delete next[key]; next[comparator] = value; return next;
}
