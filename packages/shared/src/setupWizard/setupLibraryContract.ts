/**
 * Le contrat de l'assistant d'installation : les dossiers que voit Jellyfin
 * et ses bibliothèques — lues pour tout Jellyfin relié, CRÉÉES (de vraies
 * bibliothèques Jellyfin, `/Library/VirtualFolders`) pour un Jellyfin neuf
 * seulement (`setupFlowContract.ts`, geste `createLibraries`).
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/setup/`, comme les
 * autres fichiers du contrat (`setupWizardMirror.test.ts`).
 */

import type { SetupErrorCode } from "./setupWizardContract";

/** `GET /api/setup/jellyfin/browse?path=` — un dossier du système de fichiers DE JELLYFIN. */
export interface BrowseEntry {
  name: string;
  path: string;
}

/**
 * La forme des chemins de la machine de JELLYFIN : `posix` (Linux, macOS, un
 * conteneur — `/media/films`) ou `windows` (lecteurs et `D:\Films`). C'est
 * elle, pas le système de Tentacle, qui décide de ce que l'écran montre.
 */
export type PathStyle = "posix" | "windows";

export interface BrowseResult {
  /** `null` : la racine (les lecteurs, ou `/`). */
  path: string | null;
  parent: string | null;
  entries: BrowseEntry[];
  /** Absent : un serveur d'avant (on suppose `posix`). */
  style?: PathStyle;
}

/** `C:\`, `D:/Films`, `\\nas\partage` : un chemin Windows. */
export function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:([\\/]|$)/.test(path) || path.startsWith("\\\\");
}

/** La forme des chemins d'après ceux que Jellyfin a rendus (lecteurs, dossier ouvert). */
export function pathStyleOf(paths: readonly string[]): PathStyle {
  return paths.some(isWindowsPath) ? "windows" : "posix";
}

export type LibraryType = "movies" | "tvshows" | "mixed";

export interface LibraryPlan {
  name: string;
  type: LibraryType;
  paths: string[];
}

/** `GET /api/setup/jellyfin/libraries` — les bibliothèques déjà là (un tableau). */
export interface ExistingLibrary {
  name: string;
  type: string | null;
  paths: string[];
}

/** `POST /api/setup/jellyfin/libraries` */
export interface LibrariesRequest {
  libraries: LibraryPlan[];
  metadataLanguage: string;
  metadataCountry: string;
}

/** La réponse de `POST /api/setup/jellyfin/libraries` : une issue par bibliothèque demandée (un tableau). */
export interface LibraryOutcome {
  name: string;
  status: "created" | "exists" | "failed";
  error?: SetupErrorCode;
}
