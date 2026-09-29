import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";

/**
 * Ce que la compatibilité garde sur disque entre deux démarrages (manifeste
 * adopté, dernière version de Jellyfin connue) : de petits JSON, écrits en
 * entier ou pas du tout.
 */

/** Le contenu du fichier, ou `undefined` s'il manque ou ne se lit pas. */
export function readJsonFile(path: string): unknown {
  try {
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Écrit à côté puis renomme : un arrêt en pleine écriture laisse l'ancien
 * fichier intact, jamais un demi-JSON. Un échec (disque plein, droits) est
 * journalisé et n'interrompt rien — la valeur reste connue en mémoire.
 */
export function writeJsonFile(path: string, value: unknown): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(value, null, 2), "utf-8");
    renameSync(temporary, path);
  } catch (err) {
    console.warn(`[compat] écriture de ${path} impossible : ${err instanceof Error ? err.message : String(err)}`);
  }
}
