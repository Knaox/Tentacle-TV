import {
  PLATFORM_FAMILIES,
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

/**
 * Les clés « une famille » (id canonique seul) des familles dont au moins un
 * id est présent dans la région — celles que le menu propose. Sans annuaire
 * (liste vide), aucune : rien à précalculer sans disponibilités.
 */
export function familyFilterKeys(regional: ReadonlyArray<{ id: number }>): string[] {
  const present = new Set(regional.map((p) => p.id));
  return PLATFORM_FAMILIES.filter((f) => f.ids.some((id) => present.has(id))).map((f) => filterKeyOf([f.ids[0]]));
}

/** Une clé « une famille » : précalculée en fond et jamais évincée — c'est la
 *  promesse d'un premier clic instantané sur n'importe quelle plateforme. */
export function isFamilyFilterKey(filterKey: string): boolean {
  if (!/^\d+$/.test(filterKey)) return false;
  const id = Number(filterKey);
  return PLATFORM_FAMILIES.some((f) => f.ids[0] === id);
}

/** Les clés qu'un compte actif maintient : « all » d'abord, puis le filtre
 *  sauvegardé, les filtres servis récemment, puis une clé par famille —
 *  uniques, dans cet ordre (le plus utile est reconstruit en premier). */
export function maintainedFilterKeys(
  saved: string | null,
  live: readonly string[],
  families: readonly string[]
): string[] {
  const keys = ["all"];
  for (const key of [saved ?? "all", ...live, ...families]) {
    if (key !== "all" && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
