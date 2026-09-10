export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  emit(type, detail = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(detail);
  }
}
