import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";

/**
 * L'interface web du serveur, désactivable (`TENTACLE_WEB_UI=off`) : le
 * client web (`/`, `/assets`, ses routes) répond alors 404. Restent servis :
 *
 *  - `/api/*` et les sockets (`/api/ws`) — les applications en vivent ;
 *  - `/tv` — le client des téléviseurs LG, une application à part entière ;
 *  - `/.well-known/*` — le défi du test d'ouverture ;
 *  - les logos publics (`/tentacle-logo*`), chargés par URL par les
 *    extensions, y compris dans les applications ;
 *  - TOUT le client tant que l'installation n'est pas finie : l'assistant en
 *    est une page. Posée avant la fin, l'option ne ferme le web qu'après.
 *
 * Retour en arrière : `TENTACLE_WEB_UI=on` et un redémarrage, ou
 * `tentacle web on` dans le conteneur (un fichier de `data/`, relu toutes les
 * cinq secondes : sans redémarrage). La commande l'emporte sur la variable ;
 * `tentacle web default` rend la main à la variable.
 *
 * Pas de réglage dans l'administration : l'administration EST l'interface
 * web — l'y couper enfermerait dehors qui l'a coupée.
 */
export const WEB_UI_OVERRIDE_FILE = resolve(DATA_ROOT, "web-ui");

export type WebUiSource = "cli" | "env" | "default";

/** `on`/`off` et leurs variantes ; autre chose : rien (la valeur suivante décide). */
export function parseWebUiSwitch(raw: string | undefined | null): boolean | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (["on", "true", "1", "yes", "enabled"].includes(value)) return true;
  if (["off", "false", "0", "no", "disabled"].includes(value)) return false;
  return null;
}

export function readOverrideFile(file: string = WEB_UI_OVERRIDE_FILE): string | null {
  try {
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  } catch {
    return null;
  }
}

export function resolveWebUi(env: NodeJS.ProcessEnv, override: string | null): { enabled: boolean; source: WebUiSource } {
  const cli = parseWebUiSwitch(override);
  if (cli !== null) return { enabled: cli, source: "cli" };
  const fromEnv = parseWebUiSwitch(env.TENTACLE_WEB_UI);
  if (fromEnv !== null) return { enabled: fromEnv, source: "env" };
  return { enabled: true, source: "default" };
}

/** La commande `tentacle web on|off` : le fichier ; `default` l'efface. */
export function writeWebUiOverride(value: "on" | "off" | null, file: string = WEB_UI_OVERRIDE_FILE): void {
  if (value === null) rmSync(file, { force: true });
  else writeFileSync(file, `${value}\n`, { mode: 0o644 });
}

const TTL_MS = 5_000;
let cached: { at: number; enabled: boolean } | null = null;

/** L'état en service, relu au plus toutes les cinq secondes (la commande prend effet sans redémarrage). */
export function isWebUiEnabled(now: number = Date.now()): boolean {
  if (cached && now - cached.at < TTL_MS) return cached.enabled;
  const { enabled } = resolveWebUi(process.env, readOverrideFile());
  cached = { at: now, enabled };
  return enabled;
}

export function resetWebUiCache(): void {
  cached = null;
}

const ALWAYS_SERVED = ["/api/", "/tv/", "/.well-known/", "/tentacle-logo"];

/** Ce chemin est-il refusé (404) ? Seulement le client web, seulement une fois l'installation finie. */
export function webUiBlocks(path: string, state: { enabled: boolean; setupComplete: boolean }): boolean {
  if (state.enabled || !state.setupComplete) return false;
  if (path === "/api" || path === "/tv") return false;
  return !ALWAYS_SERVED.some((prefix) => path.startsWith(prefix));
}
