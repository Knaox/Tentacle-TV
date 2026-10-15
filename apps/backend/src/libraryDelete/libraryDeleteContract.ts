/**
 * Supprimer des titres de la bibliothèque — le CONTRAT (docs/DROITS-UTILISATEURS.md § 9.7).
 *
 * Jellyfin décide de tout : où le compte peut supprimer (`EnableContentDeletion`,
 * `EnableContentDeletionFromFolders` de SA politique), et, titre par titre, s'il le
 * peut (`CanDelete`, calculé pour le compte). Le serveur Tentacle ne fait que relayer
 * avec le jeton DU COMPTE — jamais la clé d'API, qui passerait outre — un titre à la
 * fois : `DELETE /Items?ids=` de Jellyfin (10.11, 12) s'arrête au premier refus sans
 * dire lequel, les titres d'avant supprimés, ceux d'après jamais tentés (mesuré).
 *
 * Web et bureau seulement, en session PERSONNELLE : jamais une TV jumelée, une
 * session de profil ni « voir en tant que ».
 *
 * MIROIR : `apps/backend/src/libraryDelete/libraryDeleteContract.ts`, octet pour
 * octet (le backend ne dépend pas de `@tentacle-tv/shared`). On modifie ICI, puis :
 *
 *   cp packages/shared/src/libraryDelete/libraryDeleteContract.ts apps/backend/src/libraryDelete/
 *
 * Aucun import : le fichier compile seul des deux côtés. Les noms traversent le
 * réseau : ils ne se renomment jamais une fois livrés.
 */

const MINUTE = 60_000;

export const LIBRARY_DELETE_ROUTES = {
  /** → `LibraryDeletionRightsDto` (toujours 200 : « nulle part » pour une session qui ne supprime pas). */
  rights: { method: "GET", path: "/api/library/deletion/rights" },
  /** `LibraryDeleteRequest` → `LibraryDeleteResponse`, ou `LibraryDeleteRefusalBody`. */
  delete: { method: "POST", path: "/api/library/deletion", rateLimit: { max: 120, windowMs: MINUTE } },
} as const;

/**
 * Au plus tant de titres par appel : le client envoie la sélection par LOTS, et la
 * progression se lit entre deux. Une série emporte ses saisons et ses épisodes :
 * un lot peut durer plusieurs secondes chez Jellyfin.
 */
export const LIBRARY_DELETE_BATCH_MAX = 20;

/** Où ce compte peut supprimer, d'après SA politique Jellyfin (relue, jamais gardée). */
export interface LibraryDeletionRightsDto {
  /** `EnableContentDeletion` : dans toutes les bibliothèques. */
  everywhere: boolean;
  /** `EnableContentDeletionFromFolders` : ces bibliothèques-là (identifiants normalisés). */
  libraryIds: string[];
}

/** Ce que rend le serveur à qui ne supprime rien — et ce que vaut une politique illisible. */
export const NO_LIBRARY_DELETION: LibraryDeletionRightsDto = { everywhere: false, libraryIds: [] };

export interface LibraryDeleteRequest {
  ids: string[];
}

/**
 * Le sort d'un titre : `deleted` (Jellyfin l'a supprimé, fichiers compris) ; `gone`
 * (déjà absent — une série supprimée avant son épisode, une autre fenêtre) ;
 * `forbidden` (Jellyfin refuse : ce compte ne peut pas supprimer CE titre) ; `failed`
 * (Jellyfin muet, en erreur, ou identifiant qu'il ne connaît pas).
 */
export type LibraryDeleteOutcome = "deleted" | "gone" | "forbidden" | "failed";

export interface LibraryDeleteItemResult {
  id: string;
  outcome: LibraryDeleteOutcome;
}

/** Un résultat par identifiant reçu, dans l'ordre reçu. */
export interface LibraryDeleteResponse {
  results: LibraryDeleteItemResult[];
}

export type LibraryDeleteRefusal = "invalid_input" | "not_personal";

export interface LibraryDeleteRefusalBody {
  error: LibraryDeleteRefusal;
}

export const LIBRARY_DELETE_REFUSAL_STATUS: Record<LibraryDeleteRefusal, number> = {
  invalid_input: 400,
  not_personal: 403,
};

/** Un identifiant de titre Jellyfin, normalisé (minuscules, sans tirets) ; `null` s'il n'en est pas un. */
export function normalizeLibraryItemId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.replace(/-/g, "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(id) ? id : null;
}

/**
 * Le corps d'une suppression, validé : les identifiants normalisés, sans doublon,
 * dans l'ordre reçu — de 1 à `LIBRARY_DELETE_BATCH_MAX`. Un seul identifiant
 * illisible, une clé de trop : `null` (le lot entier est refusé, rien n'est tenté).
 */
export function parseLibraryDeleteRequest(body: unknown): string[] | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "ids")) return null;
  if (!Array.isArray(record.ids)) return null;
  if (record.ids.length === 0 || record.ids.length > LIBRARY_DELETE_BATCH_MAX) return null;
  const ids: string[] = [];
  for (const raw of record.ids) {
    const id = normalizeLibraryItemId(raw);
    if (id === null) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Ce compte peut-il supprimer dans cette bibliothèque ? (Chaque titre reste jugé par Jellyfin.) */
export function deletionAllowedIn(rights: LibraryDeletionRightsDto | null | undefined, libraryId: string): boolean {
  if (!rights) return false;
  if (rights.everywhere) return true;
  const id = normalizeLibraryItemId(libraryId);
  return id !== null && rights.libraryIds.includes(id);
}

/** Ce compte peut-il supprimer QUELQUE PART ? (La recherche mêle les bibliothèques.) */
export function deletionAllowedSomewhere(rights: LibraryDeletionRightsDto | null | undefined): boolean {
  return !!rights && (rights.everywhere || rights.libraryIds.length > 0);
}
