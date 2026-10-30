import { store } from "expo-router/build/global-state/router-store";
import { releaseFileImportPath } from "@tentacle-tv/shared/octave/mode";
import { clearTentacleAbove, isOctaveLink } from "@/octave/launch/octaveArrival";

/**
 * Les adresses que le SYSTÈME remet à l'app, avant qu'expo-router ne les route. Deux gestes :
 * - iOS remet un document audio ouvert « dans Tentacle TV » (types de documents de l'app) par son adresse
 *   `file://` — elle devient la route de l'import des sorties (`releaseFileImportPath`) ;
 * - un lien d'OCTAVE reçu app déjà ouverte (partage de Shazam, d'une playlist…) : ce que Tentacle a empilé —
 *   une modale comprise — est fermé d'abord, Octave n'arrive jamais dans sa feuille (`octaveArrival.ts`).
 * Toute autre adresse passe telle quelle.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  const next = releaseFileImportPath(path) ?? path;
  if (!initial && isOctaveLink(next)) {
    try {
      clearTentacleAbove(store.navigationRef as never);
    } catch {
      /* La navigation n'est pas prête : le lien s'ouvre comme avant. */
    }
  }
  return next;
}
