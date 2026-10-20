/**
 * Les titres gardés sur l'appareil, jugés par le SERVEUR pour l'identité en
 * session — le compte, ou le profil de la famille ouvert par « Qui regarde ? »
 * (capacité `offline.verdicts`, serveur 1.31.1). Décision de Damien (20/10) :
 * les droits s'appliquent partout ; un titre gardé hors ligne AVANT le retrait
 * d'un droit (note maximale, bibliothèque retirée par la famille) ne se lit
 * plus. Le fichier reste sur l'appareil : seul le verdict change, et il revient
 * si le droit revient.
 *
 * `POST /api/library/visibility` `{ itemIds }` → `{ visible, hidden, gone }` :
 * - `visible` : Jellyfin le montre à cette identité (toute sa politique) ;
 * - `hidden` : il est dans la bibliothèque mais caché à cette identité — ou
 *   disparu de la bibliothèque alors que l'identité est restreinte (on ne peut
 *   plus juger : fermé à l'échec) ;
 * - `gone` : disparu de la bibliothèque, identité sans restriction : il reste
 *   lisible depuis l'appareil, comme avant.
 *
 * MIROIR : `apps/backend/src/libraryVisibility/libraryVisibilityContract.ts`,
 * octet pour octet (le backend ne dépend pas de `@tentacle-tv/shared`) :
 *
 *   cp packages/shared/src/library/libraryVisibilityContract.ts apps/backend/src/libraryVisibility/
 */

export const LIBRARY_VISIBILITY_PATH = "/api/library/visibility";

/** Au plus autant de titres par demande (un appareil en garde rarement plus ; il découpe sinon). */
export const LIBRARY_VISIBILITY_MAX_ITEMS = 200;

export interface LibraryVisibilityBody {
  itemIds: string[];
}

export interface LibraryVisibilityDto {
  visible: string[];
  hidden: string[];
  gone: string[];
}

export type LibraryVerdict = "visible" | "hidden" | "gone";

const ITEM_ID = /^[0-9a-fA-F-]{32,36}$/;

/** Le corps, défendu : une liste d'identifiants Jellyfin, sans doublon, bornée ; sinon null. */
export function parseLibraryVisibilityBody(body: unknown): LibraryVisibilityBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "itemIds") return null;
  const ids = (body as { itemIds?: unknown }).itemIds;
  if (!Array.isArray(ids) || ids.length > LIBRARY_VISIBILITY_MAX_ITEMS) return null;
  if (!ids.every((id): id is string => typeof id === "string" && ITEM_ID.test(id))) return null;
  return { itemIds: [...new Set(ids)] };
}

/** La réponse, défendue champ par champ (un champ absent : vide). */
export function parseLibraryVisibility(data: unknown): LibraryVisibilityDto {
  const raw = (data ?? {}) as Partial<Record<keyof LibraryVisibilityDto, unknown>>;
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  return { visible: list(raw.visible), hidden: list(raw.hidden), gone: list(raw.gone) };
}
