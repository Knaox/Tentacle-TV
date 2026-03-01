import type { TentaclePlugin } from "./types";

/* ------------------------------------------------------------------ */
/*  In-memory plugin registry (client-side)                            */
/* ------------------------------------------------------------------ */

const _plugins = new Map<string, TentaclePlugin>();
const _listeners = new Set<() => void>();
let _snapshot: TentaclePlugin[] = [];

function notify() {
  _snapshot = Array.from(_plugins.values());
  _listeners.forEach((cb) => cb());
}

/** Register a plugin instance. */
export function registerPlugin(plugin: TentaclePlugin): void {
  _plugins.set(plugin.id, plugin);
  notify();
}

/** Unregister a plugin by id. */
export function unregisterPlugin(id: string): void {
  _plugins.delete(id);
  notify();
}

/** Get a registered plugin by id. */
export function getPlugin(id: string): TentaclePlugin | undefined {
  return _plugins.get(id);
}

/** Get all registered plugins. */
export function getAllPlugins(): TentaclePlugin[] {
  return _snapshot;
}

/** Subscribe to registry changes. Returns unsubscribe function. */
export function subscribeRegistry(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

/** Snapshot for useSyncExternalStore — must return a stable reference. */
export function getRegistrySnapshot(): TentaclePlugin[] {
  return _snapshot;
}
