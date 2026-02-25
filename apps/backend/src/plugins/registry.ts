import type { RequestPlugin } from "./types";
import { SeerrPlugin } from "./seerr";

let _activePlugin: RequestPlugin | null = null;

/** Get the currently active request plugin (Seerr by default). */
export function getActivePlugin(): RequestPlugin | null {
  if (!_activePlugin) {
    const seerrUrl = process.env.SEERR_URL;
    const seerrKey = process.env.SEERR_API_KEY;
    if (seerrUrl && seerrKey) {
      _activePlugin = new SeerrPlugin();
    }
  }
  return _activePlugin;
}

/** Register a custom plugin (for future extensibility). */
export function registerPlugin(plugin: RequestPlugin): void {
  _activePlugin = plugin;
}
