import { CONDITION_DEFINITIONS } from "./ConditionCatalog.js";

function valueAt(path, state, context) {
  if (path === undefined) return undefined;
  if (typeof path !== "string") return path;
  if (path === "true") return true;
  if (path === "false") return false;
  if (path.startsWith("flag.")) return Boolean(state.flags[path.slice(5)]);
  if (path.startsWith("var.")) return state.vars[path.slice(4)] ?? 0;
  if (path.startsWith("inventory.")) return state.inventory.includes(path.slice(10));
  if (path.startsWith("room.")) {
    const [, roomId, ...keys] = path.split(".");
    return keys.reduce((value, key) => value?.[key], state.roomState[roomId] ?? {});
  }
  if (path.startsWith("context.")) {
    return path.slice(8).split(".").reduce((value, key) => value?.[key], context);
  }
  return path;
}

function compare(actual, condition) {
  if (Object.hasOwn(condition, "equals")) return actual === condition.equals;
  if (Object.hasOwn(condition, "notEquals")) return actual !== condition.notEquals;
  if (Object.hasOwn(condition, "gt")) return actual > condition.gt;
  if (Object.hasOwn(condition, "gte")) return actual >= condition.gte;
  if (Object.hasOwn(condition, "lt")) return actual < condition.lt;
  if (Object.hasOwn(condition, "lte")) return actual <= condition.lte;
  return Boolean(actual);
}

export function evaluateCondition(condition, state, context = {}) {
  if (condition === undefined || condition === null || condition === true || condition === "true") return true;
  if (condition === false || condition === "false") return false;
  if (typeof condition === "string") {
    if (condition.startsWith("!")) return !Boolean(valueAt(condition.slice(1), state, context));
    return Boolean(valueAt(condition, state, context));
  }
  if (Array.isArray(condition)) return condition.every((entry) => evaluateCondition(entry, state, context));
  const definition = CONDITION_DEFINITIONS.find((candidate) => candidate.evaluate && candidate.detect(condition));
  if (definition) return definition.evaluate(condition, { state, context, compare, valueAt: (path) => valueAt(path, state, context), evaluate: (value) => evaluateCondition(value, state, context) });
  throw new Error(`Unknown condition: ${JSON.stringify(condition)}`);
}
