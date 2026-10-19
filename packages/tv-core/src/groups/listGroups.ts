import {
  FIRST_DECADE,
  LETTER_RANGES,
  RATING_STEPS,
  SMALL_GENRE,
  decadeOf,
  letterLabel,
  letterRangeOf,
  ratingLabel,
  ratingStepOf,
  type GroupLabel,
  type GroupMode,
} from "./groupModel";

/**
 * Les rangées d'une LISTE (Ma liste, Mes favoris) — toute la liste est en
 * mémoire : chaque titre va dans UN groupe, rien en double (banc du 19/10).
 *
 * - type : Films, Séries, Animés (une série d'animation) ;
 * - genre : le PREMIER genre du titre ; les plus gros groupes d'abord, les
 *   genres de moins de `SMALL_GENRE` titres réunis dans « Autres genres », en
 *   dernier ;
 * - lettres : « A – C »… « V – Z », puis « 0 – 9 » ;
 * - décennie : la plus récente d'abord, puis « Avant 1970 » (et les titres
 *   sans année) ;
 * - note : « 8 et plus », « De 7 à 8 », « De 6 à 7 », « Moins de 6 », « Sans note ».
 *
 * Dans un groupe, l'ordre reçu (le tri choisi) est gardé. Un groupe vide n'a
 * pas de rangée.
 */

export interface GroupableItem {
  id: string;
  title: string;
  kind: "movie" | "series" | "other";
  /** Un genre d'animation (« Animation », « Anime ») : une série animée va dans « Animés ». */
  animated: boolean;
  genres: readonly string[];
  year: number | null;
  rating: number | null;
}

export interface ItemGroup {
  /** Stable d'un rendu à l'autre (la clé de la rangée et de ses cartes). */
  key: string;
  label: GroupLabel;
  ids: string[];
}

interface Bucket {
  key: string;
  label: GroupLabel;
  rank: number;
  ids: string[];
}

const TYPE_ORDER = ["movies", "series", "anime"] as const;

function bucketOf(item: GroupableItem, mode: GroupMode): Omit<Bucket, "ids"> {
  switch (mode) {
    case "type": {
      const type = item.kind === "series" ? (item.animated ? "anime" : "series") : "movies";
      return { key: `type:${type}`, label: { kind: "type", type }, rank: TYPE_ORDER.indexOf(type) };
    }
    case "genre": {
      const name = item.genres[0];
      return name ? { key: `genre:${name}`, label: { kind: "genre", name }, rank: 0 } : { key: "genre:other", label: { kind: "otherGenres" }, rank: 0 };
    }
    case "alpha": {
      const at = letterRangeOf(item.title);
      return { key: `alpha:${at}`, label: letterLabel(at), rank: at };
    }
    case "year": {
      if (item.year == null || item.year < FIRST_DECADE) return { key: "year:before", label: { kind: "before", year: FIRST_DECADE }, rank: Number.MAX_SAFE_INTEGER };
      const decade = decadeOf(item.year);
      return { key: `year:${decade}`, label: { kind: "decade", decade }, rank: -decade };
    }
    case "rating": {
      const step = ratingStepOf(item.rating);
      return { key: step < 0 ? "rating:none" : `rating:${step}`, label: ratingLabel(step), rank: step < 0 ? RATING_STEPS.length + 1 : step };
    }
  }
}

export function groupItems(items: readonly GroupableItem[], mode: GroupMode): ItemGroup[] {
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    const at = bucketOf(item, mode);
    const bucket = buckets.get(at.key) ?? { ...at, ids: [] };
    bucket.ids.push(item.id);
    buckets.set(at.key, bucket);
  }
  const all = [...buckets.values()];
  if (mode !== "genre") return all.sort((a, b) => a.rank - b.rank).map(({ key, label, ids }) => ({ key, label, ids }));
  // Par genre : les plus gros d'abord ; les petits réunis, en dernier.
  const other = buckets.get("genre:other");
  let small = all.filter((b) => b !== other && b.ids.length < SMALL_GENRE);
  const big = all.filter((b) => b !== other && b.ids.length >= SMALL_GENRE).sort((a, b) => b.ids.length - a.ids.length);
  // Un seul petit genre, sans titre « sans genre » : il garde son nom (comme dans une bibliothèque).
  if (small.length === 1 && !other) {
    big.push(small[0]);
    small = [];
  }
  const rest = [...(other?.ids ?? []), ...small.flatMap((b) => b.ids)];
  const groups = big.map(({ key, label, ids }) => ({ key, label, ids }));
  if (rest.length > 0) groups.push({ key: "genre:other", label: { kind: "otherGenres" }, ids: keepOrder(items, rest) });
  return groups;
}

/** Les identifiants dans l'ordre de la liste (les petits genres réunis gardent le tri choisi). */
function keepOrder(items: readonly GroupableItem[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return items.filter((item) => wanted.has(item.id)).map((item) => item.id);
}

/** Le nombre de tranches de lettres, « 0 – 9 » compris (pour l'ordre fixe). */
export const LETTER_GROUP_COUNT = LETTER_RANGES.length + 1;
