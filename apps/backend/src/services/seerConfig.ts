import { usablePlugins } from "./pluginStorage/gate";

export interface SeerrConfig {
  url: string;
  apiKey: string;
}

/**
 * Configuration Jellyseerr du plugin Vigie (`seer`), lue dans installed.json
 * par la règle commune des extensions. Null si le plugin est absent, refusé
 * ou non configuré — TOUT consommateur doit dégrader proprement (pas
 * d'erreur, pas de rangée vide criarde) : le cœur ne dépend jamais durement
 * d'un plugin.
 */
export function getSeerrConfig(): SeerrConfig | null {
  try {
    // La règle commune (pluginStorage/gate.ts) : installée, activée, et pas
    // refusée par ce serveur — sans elle, le cœur servait des rangées et des
    // recommandations de Vigie pendant que Vigie, refusée, n'existait plus.
    const seer = usablePlugins().find((p) => p.pluginId === "seer");
    // Intégration désactivée par l'admin : même dégradation que le client
    // (les routes /discover ne sont enregistrées que si config.enabled) —
    // sinon le serveur sert des rangées Vigie dont la navigation n'existe
    // plus côté SPA.
    const config = seer?.config as { enabled?: unknown; url?: unknown; apiKey?: unknown } | undefined;
    if (config?.enabled !== true) return null;
    const url = typeof config.url === "string" ? config.url : "";
    const apiKey = typeof config.apiKey === "string" ? config.apiKey : "";
    if (!url || !apiKey) return null;
    return { url: url.replace(/\/$/, ""), apiKey };
  } catch {
    return null;
  }
}
