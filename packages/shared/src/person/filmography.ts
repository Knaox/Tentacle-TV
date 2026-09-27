/**
 * La filmographie d'une personne DANS la bibliothèque — pur, sans React.
 *
 * Une entrée = un titre et ce que la personne y a fait (le type Jellyfin du
 * crédit : `Actor`, `Director`…). La page de la personne en tire ses filtres
 * (films / séries, rôle) et son décor ; le mobile et le web lisent la même
 * chose, dans le même ordre.
 */

/** Ce qu'une entrée doit porter — `MediaItem` comme `SearchMediaItem` s'y plient. */
export interface FilmographyItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  BackdropImageTags?: string[];
}

export interface FilmographyEntry<T extends FilmographyItem = FilmographyItem> {
  item: T;
  /** Le type Jellyfin du crédit, tel quel ; `null` quand la source ne le dit pas. */
  role: string | null;
}

/** Les rôles qu'on sait nommer — l'ordre est celui des filtres à l'écran. */
export const CREDIT_ROLES = ["Actor", "Director", "Writer", "Creator", "Producer", "Composer"] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number] | "Other";

/** Le crédit Jellyfin ramené à un rôle affichable (`GuestStar` joue, lui aussi). */
export function normalizeCreditRole(role: string | null | undefined): CreditRole | null {
  if (typeof role !== "string" || role === "") return null;
  if (role === "GuestStar") return "Actor";
  return (CREDIT_ROLES as readonly string[]).includes(role) ? (role as CreditRole) : "Other";
}

/**
 * La clé i18n du rôle (espace `media`) — `roleActor`, `roleDirector`…
 * Nom construit, mais d'un ensemble FERMÉ : les six rôles et `roleOther`.
 */
export function creditRoleKey(role: CreditRole): string {
  return `role${role}`;
}

export type FilmographyKind = "all" | "movie" | "series";

export interface FilmographyFacets {
  total: number;
  movies: number;
  series: number;
  /** Les rôles tenus, les plus fréquents d'abord (à égalité, l'ordre de `CREDIT_ROLES`). */
  roles: Array<{ role: CreditRole; count: number }>;
}

function kindOf(type: string): Exclude<FilmographyKind, "all"> | null {
  if (type === "Movie") return "movie";
  if (type === "Series") return "series";
  return null;
}

const ROLE_ORDER: readonly CreditRole[] = [...CREDIT_ROLES, "Other"];

export function filmographyFacets(entries: readonly FilmographyEntry[]): FilmographyFacets {
  const counts = new Map<CreditRole, number>();
  let movies = 0;
  let series = 0;
  for (const entry of entries) {
    const kind = kindOf(entry.item.Type);
    if (kind === "movie") movies++;
    else if (kind === "series") series++;
    const role = normalizeCreditRole(entry.role);
    if (role !== null) counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  const roles = [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return { total: entries.length, movies, series, roles };
}

export function filterFilmography<T extends FilmographyItem>(
  entries: readonly FilmographyEntry<T>[],
  filter: { kind: FilmographyKind; role: CreditRole | null },
): FilmographyEntry<T>[] {
  return entries.filter((entry) =>
    (filter.kind === "all" || kindOf(entry.item.Type) === filter.kind)
    && (filter.role === null || normalizeCreditRole(entry.role) === filter.role));
}

/**
 * Le titre qui prête son décor à la page : le mieux noté de ceux qui ont une
 * image de fond. Une personne n'a pas de backdrop dans Jellyfin — son œuvre, si.
 */
export function backdropSource<T extends FilmographyItem>(entries: readonly FilmographyEntry<T>[]): T | null {
  let best: T | null = null;
  for (const { item } of entries) {
    if (!item.BackdropImageTags || item.BackdropImageTags.length === 0) continue;
    if (best === null || (item.CommunityRating ?? 0) > (best.CommunityRating ?? 0)) best = item;
  }
  return best;
}
