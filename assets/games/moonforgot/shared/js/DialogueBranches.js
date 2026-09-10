import { evaluateCondition } from "./ConditionEvaluator.js";

export function dialogueNodeHasSpeech(node = {}) {
  return Boolean(String(node.speaker ?? "").trim() || String(node.text ?? "").trim());
}

export function availableDialogueChoices(node = {}, state = {}, usedChoices = [], context = {}) {
  const wasUsed = (id) => usedChoices instanceof Set ? usedChoices.has(id) : usedChoices.includes(id);
  return (node.choices ?? []).filter((choice) => evaluateCondition(choice.visibleIf, state, context) && !(choice.once && wasUsed(choice.id)));
}

export function dialogueNodeDestinations(node = {}) {
  return [node.end ? null : node.next, ...(node.choices ?? []).map((choice) => choice.end ? null : choice.next), ...(node.branches ?? []).map((branch) => branch.end ? null : branch.next)].filter(Boolean);
}

export function resolveDialogueNodeDestination(node = {}, state = {}, context = {}) {
  for (const branch of node.branches ?? []) if (evaluateCondition(branch.condition ?? true, state, context)) return branch.end ? null : branch.next ?? null;
  return node.end ? null : node.next ?? null;
}
