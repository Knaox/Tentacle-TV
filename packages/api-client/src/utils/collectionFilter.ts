import { matchesSearch, type MediaItem } from "@tentacle-tv/shared";

/**
 * Filtrer et trier une collection — Ma liste, Mes favoris — EN MÉMOIRE.
 *
 * Pourquoi en mémoire et pas côté serveur, comme la bibliothèque : ces deux
 * listes sont chargées d'un bloc sous les clés `["watchlist","all"]` et
 * `["favorites","all"]`, qui sont AUSSI celles du cache optimiste — ajouter ou
 * retirer un titre depuis n'importe quelle carte de l'application les patche
 * directement. Les repaginer changerait leur clé et casserait cet ajout
 * instantané, partout, sans erreur. Et « tout sélectionner » a besoin de la
 * liste entière, qu'une source paginée ne peut pas donner.
 *
 * Le coût est nul : cinq cents titres par une dizaine de prédicats, c'est bien
 * moins d'une milliseconde, et seulement au changement de filtre — la recherche
 * étant débrayée en amont.
 */

export type CollectionTypeTab = "all" | "Movie" | "Series";

export interface CollectionFilterInput {
  search: string;
  type: CollectionTypeTab;
  /** Des NOMS de genres, pas des identifiants — cf. `collectionGenres`. */
  genres: string[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  statusFilter: string | null;
  sortBy: string;
  sortOrder: string;
}

/** Aucun filtre, aucun tri : l'entrée est rendue telle quelle. */
function isNeutral(f: CollectionFilterInput): boolean {
  return (
    f.search.trim().length < 2 &&
    f.type === "all" &&
    f.genres.length === 0 &&
    f.yearFrom === null &&
    f.yearTo === null &&
    f.ratingMin === null &&
    f.statusFilter === null &&
    (f.sortBy === "DateCreated" || f.sortBy === "") &&
    f.sortOrder !== "Ascending"
  );
}

/**
 * Le statut, adapté à une collection.
 *
 * `IsUnplayed` se transpose sans peine. `IsResumable`, en revanche, diverge :
 * la bibliothèque le confie au serveur, qui bascule alors sur les ÉPISODES ;
 * une collection ne contient que des films et des séries. On lit donc la
 * reprise sur ce qu'on a — position pour un film, épisodes vus mais série
 * inachevée pour une série.
 */
function matchesStatus(item: MediaItem, status: string | null): boolean {
  if (!status) return true;
  const data = item.UserData;
  if (status === "IsUnplayed") return data?.Played !== true;
  if (status === "IsResumable") {
    if (data?.Played === true) return false;
    if (item.Type === "Series") return (data?.PlayCount ?? 0) > 0;
    const pct = data?.PlayedPercentage ?? 0;
    return (data?.PlaybackPositionTicks ?? 0) > 0 || (pct > 0 && pct < 100);
  }
  return true;
}

/** Comparaison numérique, les valeurs absentes toujours en dernier. */
function byNumber(a: number | undefined, b: number | undefined, asc: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return asc ? a - b : b - a;
}

export function filterCollection(
  items: readonly MediaItem[],
  input: CollectionFilterInput,
): MediaItem[] {
  // Même référence quand rien n'est demandé : la grille ne se re-rend pas au
  // montage pour un tableau recopié à l'identique.
  if (isNeutral(input)) return items as MediaItem[];

  const query = input.search.trim();
  const searching = query.length >= 2;
  const wanted = new Set(input.genres);

  const kept = items.filter((item) => {
    if (input.type !== "all" && item.Type !== input.type) return false;
    if (searching && !matchesSearch(item.Name ?? "", query)) return false;
    if (wanted.size > 0 && !(item.Genres ?? []).some((g) => wanted.has(g))) return false;
    const year = item.ProductionYear;
    if (input.yearFrom != null && (year == null || year < input.yearFrom)) return false;
    if (input.yearTo != null && (year == null || year > input.yearTo)) return false;
    if (input.ratingMin != null && (item.CommunityRating ?? 0) < input.ratingMin) return false;
    if (!matchesStatus(item, input.statusFilter)) return false;
    return true;
  });

  const asc = input.sortOrder === "Ascending";
  // `Array.prototype.sort` est stable depuis ES2019 : c'est ce qui permet au
  // tri par date de n'être qu'une lecture de l'ordre reçu (voir plus bas).
  switch (input.sortBy) {
    case "SortName":
      return kept.sort((a, b) => {
        const c = (a.Name ?? "").localeCompare(b.Name ?? "", undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return asc ? c : -c;
      });
    case "ProductionYear":
      return kept.sort((a, b) => byNumber(a.ProductionYear, b.ProductionYear, asc));
    case "CommunityRating":
      return kept.sort((a, b) => byNumber(a.CommunityRating, b.CommunityRating, asc));
    case "DateCreated":
      // La requête trie déjà `DateCreated Descending` : l'INDICE dans le
      // tableau source EST la date, et l'ordre croissant en est l'inverse.
      // Zéro champ demandé en plus, zéro octet transmis — `DateCreated` est un
      // `ItemField` que ces deux requêtes ne réclament pas.
      return asc ? kept.reverse() : kept;
    default:
      return kept;
  }
}

/**
 * Les genres présents dans une collection, comme le menu les attend.
 *
 * Ces pages n'ont pas de bibliothèque parente, donc pas de `useGenres` : les
 * genres se dérivent des titres déjà chargés. Et pour une collection,
 * l'identifiant EST le nom — c'est ce que les items portent (`Genres` est une
 * liste de noms), et cela rend l'URL lisible : `?genres=Action,Drame`.
 *
 * Les noms contenant une virgule sont écartés : le décodage des filtres découpe
 * dessus. Aucun genre n'en contient, mais l'invariant vaut d'être tenu ici
 * plutôt que découvert ailleurs.
 */
export function collectionGenres(
  items: readonly MediaItem[],
): Array<{ Id: string; Name: string }> {
  const seen = new Set<string>();
  for (const item of items) {
    for (const name of item.Genres ?? []) {
      if (name && !name.includes(",")) seen.add(name);
    }
  }
  return [...seen]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((name) => ({ Id: name, Name: name }));
}
