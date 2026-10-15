/**
 * Les LISTES que Jellyfin ne borne pas aux bibliothèques du compte.
 *
 * # Le problème (mesuré sur 10.11.11, banc du contrôle parental)
 *
 * Les bibliothèques permises d'un compte (`EnableAllFolders`, `EnabledFolders`,
 * `BlockedMediaFolders`) ne s'appliquent qu'aux listes parcourues depuis sa
 * racine. Jellyfin les oublie :
 *  - dans `Items?Ids=…` (avec `userId` ou le jeton du compte) : le titre d'une
 *    bibliothèque refusée revient — seuls note, étiquettes et non classés jouent ;
 *  - dans `Items/Latest?ParentId=<bibliothèque refusée>`, MÊME au jeton du compte ;
 *  - dans toute liste `ParentId=<refusée>` lue avec la clé prêtée (TV jumelée,
 *    profil, « voir en tant que ») — au jeton du compte, Jellyfin refuse ;
 *  - dès qu'une SÉRIE ou une saison est nommée (`Shows/{id}/Episodes`,
 *    `Shows/NextUp?SeriesId=`, `SeasonId=`) : ses épisodes reviennent, même au
 *    jeton du compte. Jellyfin ne borne aux bibliothèques que les requêtes qui
 *    ne nomment ni parent, ni ids, ni série (`AddUserToQuery`).
 * Une TV qui garde ses bibliothèques en mémoire, une rangée épinglée, des ids
 * relevés avant la restriction : les titres revenaient.
 *
 * # La règle
 *
 * Pour un compte dont les bibliothèques sont bornées (ou dont la politique est
 * illisible : fermé à l'échec), une liste dont le parent nommé (`ParentId`,
 * `SeriesId`, `SeasonId`, la série d'un chemin `Shows/{id}/…`) ne lui est pas
 * visible est rendue VIDE ; une liste d'`Ids` ne garde que les titres qu'il voit
 * (`isItemVisibleTo`, verdict de Jellyfin gardé 30 s). Tout autre compte : rien
 * ne change, aucune requête de plus que la politique en cache.
 */

import type { FastifyReply } from "fastify";
import type { Response } from "undici";
import { validateToken } from "../../middleware/auth";
import { getContentPolicy, type ContentPolicy } from "../../services/contentPolicy";
import { isItemVisibleTo, visibleItemIdsFor } from "../../services/itemAccess/itemVisibility";

export interface LibraryListGuard {
  /** Le corps à rendre AU LIEU de la liste (son parent est refusé), sinon `null`. */
  empty: string | null;
  /** Le compte dont la liste d'`Ids` est à filtrer à la réponse, sinon `null`. */
  filterUser: string | null;
}

const PASS: LibraryListGuard = { empty: null, filterUser: null };

/** Les listes d'ids que Jellyfin rend (chemin ENVOYÉ, après `modernRoutes`). */
const IDS_LIST = /^(Users\/[^/]+\/)?Items$/i;

export interface ListScope {
  /** Les dossiers nommés : parent, série, saison. Tous doivent être visibles. */
  parents: string[];
  ids: boolean;
  /** Le `userId` de la requête : Jellyfin refuse celui d'un autre compte à un jeton non administrateur. */
  userId: string | null;
}

const PARENT_PARAMS = new Set(["parentid", "seriesid", "seasonid"]);
const SERIES_PATH = /^Shows\/([^/]+)\/(Episodes|Seasons)$/i;

/** Ce que la requête nomme : ses parents, et si elle liste des ids. Pur. */
export function listScope(method: string, path: string, query: string): ListScope | null {
  if (method !== "GET") return null;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const series = SERIES_PATH.exec(path)?.[1];
  const scope: ListScope = { parents: series ? [series] : [], ids: false, userId: /^Users\/([^/]+)\//i.exec(path)?.[1] ?? null };
  for (const [key, value] of params) {
    const lower = key.toLowerCase();
    if (PARENT_PARAMS.has(lower) && value) scope.parents.push(value);
    if (lower === "ids" && value && IDS_LIST.test(path)) scope.ids = true;
    if (lower === "userid" && value) scope.userId = value;
  }
  return scope.parents.length > 0 || scope.ids ? scope : null;
}

/** Les bibliothèques du compte sont-elles bornées ? Politique illisible : oui. */
export function limitsLibraries(policy: ContentPolicy): boolean {
  return !policy.readable || !policy.enableAllFolders || policy.blockedMediaFolders.length > 0;
}

/** La forme vide de la liste demandée : un tableau pour `Latest`, sinon `{ Items }`. */
export function emptyListBody(path: string): string {
  return /\/Latest$/i.test(path) ? "[]" : JSON.stringify({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
}

export async function libraryListGuard(
  method: string,
  path: string,
  query: string,
  token: string | undefined,
  knownUserId: string | null,
): Promise<LibraryListGuard> {
  const scope = listScope(method, path, query);
  if (!scope) return PASS;
  let userId = knownUserId ?? scope.userId;
  if (!userId && token) {
    const validation = await validateToken(token);
    userId = validation.ok ? validation.user.userId : null;
  }
  // Sans compte identifiable, Jellyfin décide seul (et refuse l'anonyme).
  if (!userId || !limitsLibraries(await getContentPolicy(userId))) return PASS;
  const verdicts = await Promise.all(scope.parents.map((parent) => isItemVisibleTo(userId as string, parent)));
  if (verdicts.includes(false)) return { empty: emptyListBody(path), filterUser: null };
  return scope.ids ? { empty: null, filterUser: userId } : PASS;
}

/** `{ Items }` réduit aux titres visibles du compte ; tout autre corps, tel quel. */
export async function keepVisibleItems(text: string, userId: string): Promise<string> {
  let body: { Items?: Array<{ Id?: unknown }>; TotalRecordCount?: number };
  try {
    body = JSON.parse(text);
  } catch {
    return text;
  }
  if (!body || !Array.isArray(body.Items)) return text;
  const ids = body.Items.map((item) => (typeof item?.Id === "string" ? item.Id : ""));
  const visible = new Set(await visibleItemIdsFor(userId, ids.filter(Boolean)));
  const kept = body.Items.filter((_item, index) => visible.has(ids[index]));
  const removed = body.Items.length - kept.length;
  if (removed === 0) return text;
  const total = typeof body.TotalRecordCount === "number" ? Math.max(0, body.TotalRecordCount - removed) : undefined;
  return JSON.stringify({ ...body, Items: kept, ...(total !== undefined ? { TotalRecordCount: total } : {}) });
}

/** Rend la réponse d'une liste d'`Ids`, filtrée pour le compte. */
export async function sendVisibleItems(reply: FastifyReply, response: Response, userId: string): Promise<FastifyReply> {
  const body = await keepVisibleItems(await response.text(), userId);
  reply.removeHeader("content-encoding");
  reply.removeHeader("content-length");
  reply.header("content-length", Buffer.byteLength(body));
  return reply.send(body);
}
