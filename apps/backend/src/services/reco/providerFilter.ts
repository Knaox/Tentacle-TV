import {
  canonicalFamilyIds,
  expandFamilyIds,
  familyOfProvider,
  familyOfProviderId,
} from "../tmdb/platforms";

/** Au plus douze ids canoniques : « page:283+415+… » doit tenir dans le
 *  rowKey VarChar(64) de recommendation_cache. */
export const PROVIDER_FILTER_MAX = 12;

/** Sous un filtre, une rangée de moins de quatre titres n'est pas une rangée. */
export const FILTERED_ROW_MIN_ITEMS = 4;

function collectRaw(raw: unknown, out: string[]): void {
  if (typeof raw === "number") out.push(String(raw));
  else if (typeof raw === "string") out.push(...raw.split(/[,+\s]+/));
  else if (Array.isArray(raw)) for (const v of raw) collectRaw(v, out);
}

/**
 * `?providers=283,1968` (ou `283+1968`, ou la clé répétée) → ids CANONIQUES
 * (chaque id ramené à l'id principal de sa famille), uniques, triés, bornés à
 * PROVIDER_FILTER_MAX ; rien de valide → null (« toutes les plateformes »).
 * Deux sélections équivalentes donnent la même clé, donc le même snapshot.
 */
export function providerFilterFromQuery(raw: unknown): number[] | null {
  const parts: string[] = [];
  collectRaw(raw, parts);
  const ids = parts.map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0);
  const canonical = canonicalFamilyIds(ids).slice(0, PROVIDER_FILTER_MAX);
  return canonical.length > 0 ? canonical : null;
}

/** La clé de snapshot : "all" ou les ids canoniques joints par « + ». */
export function filterKeyOf(ids: readonly number[] | null): string {
  if (!ids || ids.length === 0) return "all";
  return canonicalFamilyIds(ids).join("+");
}

/**
 * Les ids ACCEPTÉS par un filtre : les familles des ids demandés, plus les
 * providers de la région dont le nom désigne l'une de ces familles — un canal
 * que la constante ne connaît pas encore (« Crunchyroll Swisscom Channel »).
 */
export function expandFamilies(
  ids: readonly number[],
  regional: ReadonlyArray<{ id: number; name: string }> = []
): Set<number> {
  const wanted = new Set(expandFamilyIds(ids));
  const familyKeys = new Set<string>();
  for (const id of ids) {
    const family = familyOfProviderId(id);
    if (family) familyKeys.add(family.key);
  }
  for (const provider of regional) {
    if (wanted.has(provider.id)) continue;
    const family = familyOfProvider(provider);
    if (family && familyKeys.has(family.key)) wanted.add(provider.id);
  }
  return wanted;
}

/** STRICT : null/undefined (disponibilité inconnue) ne passe jamais. */
export function providerIdsMatch(
  ids: readonly number[] | null | undefined,
  wanted: ReadonlySet<number>
): boolean {
  if (!ids) return false;
  return ids.some((id) => wanted.has(id));
}

/** Même règle sur des ProviderRef (items servis, rangées globales). */
export function itemMatchesFilter(
  providers: ReadonlyArray<{ id: number }> | null | undefined,
  wanted: ReadonlySet<number>
): boolean {
  if (!providers) return false;
  return providers.some((p) => wanted.has(p.id));
}
