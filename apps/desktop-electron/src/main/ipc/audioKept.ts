/**
 * Octave — la copie d'un titre GARDÉE HORS LIGNE (capacité `offline.music`),
 * lue par le moteur audio à la place du serveur.
 *
 * Le chemin vient de NOTRE base de transferts, jamais de la page : elle dit
 * seulement « ce titre, pour ce compte » (`AudioBridgeSource.kept`). Le fichier
 * est revérifié à chaque lecture (`localSource` : présent, taille exacte) — un
 * fichier effacé hors de l'application passe en défaut et le serveur reprend.
 */

import { downloadsVolume } from "../downloadsRuntime";
import { musicItemOfKey } from "../downloads/core/musicLibrary";
import { localSource } from "../downloads/core/playback";
import { localDb } from "../localDb";

/** Le chemin ABSOLU de la copie gardée de ce titre par ce compte, ou `null`. */
export function keptAudioPath(userId: string, trackKey: string): string | null {
  try {
    const db = localDb();
    const itemId = musicItemOfKey(db, trackKey);
    if (itemId === null) return null;
    return localSource(db, downloadsVolume(), userId, itemId, Date.now())?.absolutePath ?? null;
  } catch {
    // Base ou racine indisponible : le serveur, comme si rien n'était gardé.
    return null;
  }
}
