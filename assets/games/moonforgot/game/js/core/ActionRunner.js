import { ACTION_HANDLERS } from "./ActionHandlers.js";

export class ActionRunner {
  constructor(game, { random = Math.random } = {}) {
    this.game = game;
    this.random = random;
    this.scheduled = new Set();
    this.scheduleGeneration = 0;
  }

  async run(actions = [], context = {}) {
    for (const action of actions) {
      if (Object.hasOwn(action, "delay") || Object.hasOwn(action, "repeat")) this.schedule(action, context);
      else await this.execute(action, context);
    }
    this.game.refreshConditions();
  }

  schedule(action, context = {}) {
    const generation = this.scheduleGeneration;
    const executions = action.repeat === -1 ? Infinity : Math.max(0, action.repeat ?? 1);
    const task = (async () => {
      for (let index = 0; index < executions && generation === this.scheduleGeneration; index++) {
        const seconds = action.delay < 0 ? this.random() * Math.abs(action.delay) : Math.max(0, action.delay ?? 0);
        const milliseconds = seconds * 1000;
        // Infinite zero-delay tracks must still yield so malformed content cannot lock the browser.
        await this.game.wait(executions === Infinity ? Math.max(16, milliseconds) : milliseconds);
        if (generation !== this.scheduleGeneration) break;
        await this.execute(action, context);
        this.game.refreshConditions();
      }
    })();
    this.scheduled.add(task);
    task.catch((error) => this.game.handleError?.(error)).finally(() => this.scheduled.delete(task));
    return task;
  }

  cancelScheduled() { this.scheduleGeneration++; }
  waitForScheduled() { return Promise.allSettled([...this.scheduled]); }

  async execute(action, context) {
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) throw new Error(`Unknown action type: ${action.type}`);
    return handler(this, action, context);
  }
}
