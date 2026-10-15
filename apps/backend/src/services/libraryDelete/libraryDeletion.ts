/**
 * Supprimer des titres de la bibliothèque — PAR LE JETON DU COMPTE (docs/DROITS-UTILISATEURS.md § 9.7).
 *
 * Jellyfin juge chaque titre (`BaseItem.CanDelete(user)`) parce que l'appel porte
 * le jeton du compte : avec la clé d'API, il n'y a plus d'utilisateur, plus de
 * contrôle, tout part. Ce module n'en reçoit jamais d'autre.
 *
 * Un titre à la fois (`DELETE /Items/{id}`), jamais `DELETE /Items?ids=` : mesuré
 * sur 10.11.11, il s'arrête au premier refus (401) sans dire lequel, les titres
 * d'avant supprimés, ceux d'après jamais tentés — la source de 12 fait de même.
 *
 * Réponses de Jellyfin (mesurées, 10.11.11) : 204 supprimé (fichiers et dossier
 * compris) ; 401 « Unauthorized access » refusé ; 404 déjà absent ; 400
 * identifiant inconnu (GUID nul).
 */

import type { LibraryDeleteItemResult, LibraryDeleteOutcome, LibraryDeletionRightsDto } from "../../libraryDelete/libraryDeleteContract";
import { NO_LIBRARY_DELETION, normalizeLibraryItemId } from "../../libraryDelete/libraryDeleteContract";
import { getJellyfinUrl } from "../configStore";
import { jellyfinAuthHeaders } from "../jellyfinAuth";

/** Une série emporte ses saisons, ses épisodes et leurs fichiers : Jellyfin peut y passer du temps. */
const DELETE_TIMEOUT_MS = 60_000;
const READ_TIMEOUT_MS = 5_000;
/** Deux suppressions à la fois : Jellyfin écrit sa base à chacune, plus ne va pas plus vite. */
const CONCURRENCY = 2;

/** Le sort d'un titre, d'après le statut de Jellyfin. Pur. */
export function outcomeOfStatus(status: number): LibraryDeleteOutcome {
  if (status >= 200 && status < 300) return "deleted";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "gone";
  return "failed";
}

/** La politique d'un compte → où il peut supprimer. Absente, illisible : nulle part. Pur. */
export function deletionRightsOfPolicy(policy: unknown): LibraryDeletionRightsDto {
  if (policy === null || typeof policy !== "object") return NO_LIBRARY_DELETION;
  const record = policy as Record<string, unknown>;
  const folders = Array.isArray(record.EnableContentDeletionFromFolders) ? record.EnableContentDeletionFromFolders : [];
  const libraryIds: string[] = [];
  for (const raw of folders) {
    const id = normalizeLibraryItemId(raw);
    if (id !== null && !libraryIds.includes(id)) libraryIds.push(id);
  }
  return { everywhere: record.EnableContentDeletion === true, libraryIds };
}

/** Où ce compte peut supprimer : SA politique, relue par son propre jeton (`/Users/Me`). Fermé à l'échec. */
export async function readDeletionRights(token: string): Promise<LibraryDeletionRightsDto> {
  const url = getJellyfinUrl();
  if (!url) return NO_LIBRARY_DELETION;
  try {
    const res = await fetch(`${url}/Users/Me`, {
      headers: jellyfinAuthHeaders(token),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!res.ok) return NO_LIBRARY_DELETION;
    const user = (await res.json()) as { Policy?: unknown };
    // Un compte désactivé ne supprime rien, quoi que dise le reste.
    if ((user.Policy as { IsDisabled?: unknown } | undefined)?.IsDisabled === true) return NO_LIBRARY_DELETION;
    return deletionRightsOfPolicy(user.Policy);
  } catch {
    return NO_LIBRARY_DELETION;
  }
}

async function deleteOne(url: string, token: string, id: string): Promise<LibraryDeleteOutcome> {
  try {
    const res = await fetch(`${url}/Items/${id}`, {
      method: "DELETE",
      headers: jellyfinAuthHeaders(token),
      signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
    });
    return outcomeOfStatus(res.status);
  } catch {
    return "failed";
  }
}

/**
 * Supprime ces titres au nom du compte dont c'est le jeton. Un résultat par
 * identifiant, dans l'ordre reçu ; jamais d'arrêt au premier refus.
 */
export async function deleteLibraryItems(token: string, ids: readonly string[]): Promise<LibraryDeleteItemResult[]> {
  const url = getJellyfinUrl();
  if (!url) return ids.map((id) => ({ id, outcome: "failed" }));
  const outcomes: LibraryDeleteOutcome[] = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const index = next++;
      outcomes[index] = await deleteOne(url, token, ids[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return ids.map((id, index) => ({ id, outcome: outcomes[index] }));
}

/** Les comptes d'un lot — pour le journal : des nombres, jamais un titre ni un chemin. */
export function tallyOutcomes(results: readonly LibraryDeleteItemResult[]): Record<LibraryDeleteOutcome, number> {
  const tally: Record<LibraryDeleteOutcome, number> = { deleted: 0, gone: 0, forbidden: 0, failed: 0 };
  for (const { outcome } of results) tally[outcome]++;
  return tally;
}
