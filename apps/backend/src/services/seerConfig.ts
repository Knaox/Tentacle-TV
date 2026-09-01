import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { DATA_DIR } from "./pluginManager";

// Chemin résolu par pluginManager (source unique) : une résolution locale à
// base de __dirname pointe à côté du data/ réel dès qu'on se trompe d'un
// niveau, et le repli silencieux sur null masque complètement l'erreur.
const INSTALLED_PATH = resolve(DATA_DIR, "installed.json");

export interface SeerrConfig {
  url: string;
  apiKey: string;
}

/**
 * Configuration Jellyseerr du plugin Vigie (`seer`), lue dans installed.json.
 * Null si le plugin est absent ou non configuré — TOUT consommateur doit
 * dégrader proprement (pas d'erreur, pas de rangée vide criarde) : le cœur ne
 * dépend jamais durement d'un plugin.
 */
export function getSeerrConfig(): SeerrConfig | null {
  try {
    if (!existsSync(INSTALLED_PATH)) return null;
    const installed = JSON.parse(readFileSync(INSTALLED_PATH, "utf-8"));
    const seer = installed.find((p: { pluginId?: string }) => p.pluginId === "seer");
    const url = seer?.config?.url as string;
    const apiKey = seer?.config?.apiKey as string;
    if (!url || !apiKey) return null;
    return { url: url.replace(/\/$/, ""), apiKey };
  } catch {
    return null;
  }
}
