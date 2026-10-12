/**
 * Le dossier de données : `%ProgramData%\Tentacle Server`, le
 * `TENTACLE_DATA_DIR` du serveur (protocole du fil A, § 5).
 *
 * Hors du paquet, parce que MSIX efface `AppData` à la désinstallation et au
 * bouton « Réinitialiser » des Paramètres : les données restent tant que
 * l'utilisateur ne les supprime pas lui-même (« Supprimer les données du
 * serveur… », décision de Damien du 2026-10-11). Jamais `Documents` : OneDrive
 * y corrompt une base SQLite.
 *
 * L'hôte y range aussi ce qui est à lui — journaux, cache de yt-dlp, son état
 * — sous des noms que le serveur ne lit pas et qui ne sont pas des marqueurs
 * d'une installation d'avant (`LEGACY_DATA_MARKERS`).
 */
import { join } from "node:path";

export const DATA_FOLDER_NAME = "Tentacle Server";

export interface DataLayout {
  /** `TENTACLE_DATA_DIR`. */
  root: string;
  /** `XDG_CACHE_HOME` du serveur (cache de yt-dlp). */
  cache: string;
  logs: string;
  /** L'état propre à l'hôte : port choisi, assistant déjà ouvert. */
  hostState: string;
  /** Écrit par le serveur tant que l'installation n'est pas finie. */
  setupToken: string;
  /** Posé par le serveur à la fin de l'installation. */
  setupComplete: string;
  sharedDeps: string;
}

export function dataLayout(programData: string): DataLayout {
  const root = join(programData, DATA_FOLDER_NAME);
  return {
    root,
    cache: join(root, "cache"),
    logs: join(root, "logs"),
    hostState: join(root, "host.json"),
    setupToken: join(root, "setup-token.txt"),
    setupComplete: join(root, "setup-complete"),
    sharedDeps: join(root, "shared-deps"),
  };
}
