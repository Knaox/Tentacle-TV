/**
 * Le jeton de reprise laissé par une COUPURE, sur iOS.
 *
 * `NSURLSession` rend un `resumeData` de deux façons : à la pause, où
 * expo-file-system nous le donne (voir `resumeTokens`), et dans l'erreur d'une
 * tâche interrompue — que le module jetait. Un correctif (`patches/
 * expo-file-system.patch`) l'écrit désormais à côté du fichier visé, en
 * `<part>.resume` ; ce module va le chercher.
 *
 * Pourquoi un fichier plutôt que la base : il est écrit par du code natif, au
 * moment où la promesse est rejetée, et il survit à un arrêt brutal de
 * l'application. Il est effacé dès qu'il a servi — un jeton périmé ne vaut
 * rien, et le garder ferait échouer la reprise suivante.
 */

import { deleteAsync, readAsStringAsync } from "expo-file-system/legacy";

const SUFFIX = ".resume";

/** Le jeton laissé par une coupure, en base64, ou `null` s'il n'y en a pas. */
export async function readResumeSidecar(partPath: string): Promise<string | null> {
  try {
    const token = await readAsStringAsync(`${partPath}${SUFFIX}`, { encoding: "base64" });
    return token.length > 0 ? token : null;
  } catch {
    // Absent : c'est le cas courant, pas une anomalie.
    return null;
  }
}

/** Efface le jeton : il a servi, ou il ne vaut plus rien. */
export async function dropResumeSidecar(partPath: string): Promise<void> {
  try {
    await deleteAsync(`${partPath}${SUFFIX}`, { idempotent: true });
  } catch {
    // Best-effort : un jeton périmé qui reste sera écrasé au prochain échec.
  }
}
