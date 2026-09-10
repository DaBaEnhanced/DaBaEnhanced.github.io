export function layerStateNames(layer) {
  return Object.keys(layer?.states ?? {});
}

export function layerStartsVisible(layer) { return layer?.initiallyVisible !== false; }

export function resolveLayerState(layer, requestedState) {
  const names = layerStateNames(layer);
  if (!names.length) return { stateId: null, specification: layer };
  const stateId = names.includes(requestedState) ? requestedState
    : names.includes(layer.initialState) ? layer.initialState
      : names[0];
  // Legacy top-level media fields must not leak into a named state.
  const { states: _states, initialState: _initialState, type: _type, src: _src, animation: _animation, lightMode: _lightMode, lightColor: _lightColor, lightIntensity: _lightIntensity, lightSpeed: _lightSpeed, lightDuty: _lightDuty, lightSoftness: _lightSoftness, lightCore: _lightCore, ...common } = layer;
  return { stateId, specification: { ...common, ...layer.states[stateId] } };
}
