import { releaseFileImportPath } from "@tentacle-tv/shared/octave/mode";

/**
 * Les adresses que le SYSTÈME remet à l'app, avant qu'expo-router ne les route. Une seule réécriture : iOS remet un
 * document audio ouvert « dans Tentacle TV » (types de documents de l'app) par son adresse `file://` — elle devient
 * la route de l'import des sorties (`releaseFileImportPath`). Toute autre adresse passe telle quelle.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return releaseFileImportPath(path) ?? path;
}
