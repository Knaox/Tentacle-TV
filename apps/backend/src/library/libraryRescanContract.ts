/**
 * « Réanalyser maintenant » — le contrat de `POST /api/admin/library/rescan`.
 *
 * Le serveur demande à Jellyfin, avec SA clé d'administration (jamais vue d'un
 * client), une VRAIE analyse :
 *  - un titre (`itemId`) : `POST /Items/{id}/Refresh`, métadonnées ET images
 *    recherchées en profondeur (`FullRefresh`), rien de ce qui existe n'est
 *    remplacé (`ReplaceAll…=false`) — ce que fait « Rechercher les métadonnées
 *    manquantes » du tableau de bord de Jellyfin ; une série emmène ses saisons
 *    et ses épisodes ;
 *  - sans `itemId` : `POST /Library/Refresh`, l'analyse de toutes les
 *    bibliothèques (« Actualiser toutes les médiathèques »).
 *
 * Jellyfin met le travail en file et répond tout de suite : le retour dit que
 * l'analyse est LANCÉE, pas qu'elle est finie. La fiche se met à jour seule
 * quand Jellyfin annonce le titre changé (socket des comptes, « Ajouts en
 * direct »).
 *
 * Session PERSONNELLE d'un administrateur seulement (`requirePersonalAdmin`) :
 * jamais une TV jumelée, jamais un profil de la Famille.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/library/libraryRescanContract.ts` :
 *
 *   cp packages/shared/src/library/libraryRescanContract.ts apps/backend/src/library/
 *
 * `libraryRescanMirror.test.ts` (backend) refuse toute divergence. Aucun import.
 */

/** Chemin de la route (sous le préfixe `/api/admin`). */
export const LIBRARY_RESCAN_PATH = "/library/rescan";

/**
 * Identifiant Jellyfin : 32 chiffres hexadécimaux, avec ou sans tirets. Tout
 * le reste est refusé avant d'atteindre Jellyfin (aucun chemin fabriqué d'une
 * saisie libre).
 */
export const JELLYFIN_ITEM_ID_PATTERN = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export interface LibraryRescanRequest {
  /** Le titre à réanalyser ; absent = toutes les bibliothèques. */
  itemId?: string;
}

export type LibraryRescanScope = "item" | "libraries";

export interface LibraryRescanStarted {
  ok: true;
  scope: LibraryRescanScope;
}

/**
 * Pourquoi l'analyse n'est pas partie — liste FERMÉE, traduite par les clients
 * (espace i18n `metadataHint`, clés `rescanError_<code>`).
 */
export type LibraryRescanError =
  | "bad-request"
  | "not-configured"
  | "unreachable"
  | "rejected"
  | "not-found"
  | "busy"
  | "failed";

export const LIBRARY_RESCAN_ERRORS: readonly LibraryRescanError[] = [
  "bad-request",
  "not-configured",
  "unreachable",
  "rejected",
  "not-found",
  "busy",
  "failed",
];

export interface LibraryRescanFailure {
  error: LibraryRescanError;
}

/** Le code d'un refus, ou `failed` pour toute réponse hors contrat. */
export function libraryRescanErrorOf(body: unknown): LibraryRescanError {
  const code = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  return typeof code === "string" && (LIBRARY_RESCAN_ERRORS as readonly string[]).includes(code)
    ? (code as LibraryRescanError)
    : "failed";
}

/**
 * La requête que le serveur envoie à Jellyfin pour UN titre. Noms et valeurs
 * de l'API de Jellyfin 10.10 à 12.x (`ItemRefreshController`) ; `Recursive`
 * reprend ce qu'envoie l'interface de Jellyfin elle-même et reste sans effet
 * là où il n'est pas lu (un dossier rafraîchit toujours ses enfants).
 */
export const ITEM_REFRESH_QUERY =
  "Recursive=true&MetadataRefreshMode=FullRefresh&ImageRefreshMode=FullRefresh&ReplaceAllMetadata=false&ReplaceAllImages=false";
