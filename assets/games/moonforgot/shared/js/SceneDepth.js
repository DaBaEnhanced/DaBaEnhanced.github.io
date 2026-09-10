import { depthAtPosition } from "./Navigation.js";

export function depthSortedSceneItems(layers, people, nodes) {
  const items = [
    ...(layers ?? []).map((value, sequence) => ({ kind: "layer", value, depth: Number.isFinite(value.z) ? value.z : 10, sequence })),
    ...(people ?? []).map((value, sequence) => ({ kind: "character", value, depth: depthAtPosition(nodes, value), sequence }))
  ];
  return items.sort((left, right) => left.depth - right.depth
    || (left.kind === "character" && right.kind === "character" ? (left.value.y ?? 0) - (right.value.y ?? 0) : 0)
    || (left.kind === right.kind ? left.sequence - right.sequence : left.kind === "character" ? -1 : 1));
}
