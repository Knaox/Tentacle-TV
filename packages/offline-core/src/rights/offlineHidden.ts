/**
 * Les titres gardés sur l'appareil que le SERVEUR a jugés cachés à une
 * identité (`POST /api/library/visibility`, capacité `offline.verdicts`) —
 * règle pure, commune au mobile et au bureau.
 *
 * Décision de Damien (20/10) : les droits s'appliquent partout. Un titre gardé
 * hors ligne AVANT le retrait d'un droit ne se lit plus : il quitte la liste,
 * sa fiche locale et sa source de lecture. Le fichier reste sur l'appareil —
 * le droit revenu, le verdict suivant le rend.
 *
 * Le dernier verdict connu fait foi HORS LIGNE (on ne peut pas reposer la
 * question) ; en ligne, chaque verdict remplace le précédent. Un titre que le
 * verdict ne nomme pas (gardé depuis) n'est pas caché : il était visible au
 * moment d'être gardé. La carte est indexée par identité (compte ou profil),
 * identifiants sans tirets ni casse.
 */

import type { LibraryVisibilityDto } from "@tentacle-tv/shared";

/** `{ [identité]: [titres cachés] }`, tel qu'on le range dans le stockage de l'appareil. */
export type OfflineHiddenMap = Readonly<Record<string, readonly string[]>>;

export const OFFLINE_HIDDEN_STORAGE_KEY = "tentacle_offline_hidden";

const norm = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Le stockage relu, défendu : une valeur illisible vaut une carte vide. */
export function parseOfflineHidden(raw: string | null | undefined): OfflineHiddenMap {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, string[]> = {};
    for (const [identity, ids] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(ids)) out[norm(identity)] = ids.filter((id): id is string => typeof id === "string").map(norm);
    }
    return out;
  } catch {
    return {};
  }
}

/** Le verdict reçu pour cette identité remplace le précédent (vide : on retire l'entrée). */
export function applyOfflineVerdict(map: OfflineHiddenMap, identity: string, verdict: LibraryVisibilityDto): OfflineHiddenMap {
  const key = norm(identity);
  const hidden = [...new Set(verdict.hidden.map(norm))].sort();
  const next: Record<string, readonly string[]> = { ...map };
  if (hidden.length === 0) delete next[key];
  else next[key] = hidden;
  return next;
}

/** Ce titre est-il caché à cette identité ? */
export function isOfflineHidden(map: OfflineHiddenMap, identity: string | null | undefined, itemId: string): boolean {
  if (!identity) return false;
  return map[norm(identity)]?.includes(norm(itemId)) ?? false;
}

/** La liste réduite à ce que l'identité peut encore lire. */
export function withoutOfflineHidden<T extends { itemId: string }>(
  map: OfflineHiddenMap,
  identity: string | null | undefined,
  entries: readonly T[],
): T[] {
  if (!identity || !map[norm(identity)]?.length) return [...entries];
  return entries.filter((entry) => !isOfflineHidden(map, identity, entry.itemId));
}

/** Deux cartes disent-elles la même chose ? (évite une écriture et un rafraîchissement pour rien) */
export function sameOfflineHidden(a: OfflineHiddenMap, b: OfflineHiddenMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const x = a[key] ?? [];
    const y = b[key] ?? [];
    if (x.length !== y.length || x.some((id, i) => id !== y[i])) return false;
  }
  return true;
}
