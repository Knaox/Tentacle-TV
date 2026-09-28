import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Le patch optimiste d'une réponse du moteur de recherche (`/api/search`,
 * ses parcours et ses épisodes).
 *
 * Ces réponses ne sont pas des listes plates : les titres y sont rangés par
 * sections (`movies`, `series`, `collections`, `items` d'un parcours), dans
 * des « touches » `{ item, match, score }`, plus un meilleur résultat
 * (`top.hit.item`) et, pour les épisodes, un tableau `episodes`. Le patcheur
 * générique de `cacheUtils` n'y voyait rien : une carte de recherche gardait
 * son ancienne pastille après un ajout à Ma liste, jusqu'au prochain
 * rechargement. Module à part : `cacheUtils` dépasse déjà sa taille.
 *
 * Pur et immuable : rend la réponse patchée, ou `null` si rien n'a changé.
 */

type Patch = (item: MediaItem) => MediaItem;
type Matcher = (item: MediaItem) => boolean;

interface Hit {
  item: MediaItem;
}

function isHit(value: unknown): value is Hit {
  return typeof value === "object" && value !== null && "item" in value && typeof (value as Hit).item === "object";
}

function isMediaItem(value: unknown): value is MediaItem {
  return typeof value === "object" && value !== null && typeof (value as MediaItem).Id === "string";
}

/** Un tableau de touches ou de titres, patché ; `null` s'il n'a pas bougé. */
function patchArray(list: unknown[], matches: Matcher, patch: Patch): unknown[] | null {
  let changed = false;
  const next = list.map((entry) => {
    if (isHit(entry) && matches(entry.item)) {
      changed = true;
      return { ...entry, item: patch(entry.item) };
    }
    if (!isHit(entry) && isMediaItem(entry) && matches(entry)) {
      changed = true;
      return patch(entry);
    }
    return entry;
  });
  return changed ? next : null;
}

export function patchSearchResponse(data: unknown, matches: Matcher, patch: Patch): unknown | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const source = data as Record<string, unknown>;
  let next: Record<string, unknown> | null = null;

  for (const [key, value] of Object.entries(source)) {
    if (!Array.isArray(value)) continue;
    const patched = patchArray(value, matches, patch);
    if (patched) {
      next = next ?? { ...source };
      next[key] = patched;
    }
  }

  // Le meilleur résultat : `{ kind: "item", hit: { item } }`.
  const top = source.top as { kind?: string; hit?: unknown } | null | undefined;
  if (top?.kind === "item" && isHit(top.hit) && matches(top.hit.item)) {
    next = next ?? { ...source };
    next.top = { ...top, hit: { ...top.hit, item: patch(top.hit.item) } };
  }
  return next;
}
