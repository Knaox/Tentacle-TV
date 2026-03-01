import type { RequestPlugin } from "./types";

let _activePlugin: RequestPlugin | null = null;

/** Get the currently active request plugin. */
export function getActivePlugin(): RequestPlugin | null {
  return _activePlugin;
}

/** Register a custom plugin (for future extensibility). */
export function registerPlugin(plugin: RequestPlugin): void {
  _activePlugin = plugin;
}
