/**
 * Où l'application range ses données — et pourquoi ce n'est pas Electron qui décide.
 *
 * Le dossier doit être celui que l'app **Tauri** utilisait, sinon
 * `tentacle-local.db` est recréée vide : la médiathèque hors ligne et la session
 * de l'utilisateur disparaissent, sans message d'erreur, à la mise à jour.
 *
 * ⚠️ Windows et macOS s'en tirent seuls : `app_data_dir()` de Tauri y désigne le
 * même dossier qu'`appData` d'Electron (Roaming, Application Support). **Linux
 * non.** Tauri y suit la norme XDG — `$XDG_DATA_HOME`, `~/.local/share` par
 * défaut — alors qu'`appData` d'Electron pointe `$XDG_CONFIG_HOME`, donc
 * `~/.config`. Deux dossiers voisins, aucune erreur, et tout est perdu.
 *
 * La fonction est pure et prend ses entrées par la porte : c'est ce qui la rend
 * vérifiable pour les trois systèmes depuis n'importe quelle machine.
 */

import path from "node:path";

/** Identifiant hérité de l'app Tauri — il nomme le dossier de données. */
export const TAURI_IDENTIFIER = "com.tentacle.media";

export interface DataEnvironment {
  /** `process.platform`. */
  platform: NodeJS.Platform;
  /** `app.getPath("appData")` — juste pour Windows et macOS. */
  appData: string;
  /** `app.getPath("home")`. */
  home: string;
  /** `process.env` — seul `XDG_DATA_HOME` est lu. */
  env: Record<string, string | undefined>;
}

/** La racine sous laquelle vit le dossier de l'application. */
export function dataRoot(e: DataEnvironment): string {
  if (e.platform !== "linux") return e.appData;
  const xdg = e.env["XDG_DATA_HOME"];
  // Un `XDG_DATA_HOME` relatif est invalide au sens de la spécification, et
  // serait résolu depuis le dossier courant — celui d'où l'app a été lancée.
  if (xdg !== undefined && xdg !== "" && path.isAbsolute(xdg)) return xdg;
  return path.join(e.home, ".local", "share");
}

/** Le dossier de données de l'application, celui que Tauri utilisait. */
export function dataFolder(e: DataEnvironment): string {
  return path.join(dataRoot(e), TAURI_IDENTIFIER);
}
