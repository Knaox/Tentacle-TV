/**
 * La page de recommandations d'un téléviseur : des étagères de la
 * bibliothèque, et — quand la TV sait les demander — des titres hors
 * bibliothèque.
 *
 * Le moteur sert des rangées mêlées — des titres du serveur, et d'autres
 * qu'il faudrait demander (ce que proposent le web et le mobile, par une
 * extension). Sans demande possible (garde Vigie fermée, webOS), une carte
 * qu'on ne peut pas lire est une impasse au bout d'un appui : les étagères ne
 * gardent que ce qui a un `jellyfinItemId`. Garde ouverte (`external`), le
 * titre absent reste à sa place, grisé, et OK le demande. Le héros, lui, reste
 * toujours un titre de la bibliothèque : il se lit. Un même titre ne revient
 * pas d'une rangée à l'autre — à
 * trois mètres, la même affiche trois fois par page, c'est du bruit — et la
 * rangée qu'il vide ainsi disparaît.
 *
 * Générique et pur : la LG (DOM) et l'Apple TV / Android TV (React Native)
 * dessinent les mêmes étagères, dans le même ordre, avec la même tête.
 */

export interface TvRecoItemLike {
  key: string;
  jellyfinItemId: string | null;
}

export interface TvRecoRowLike<T extends TvRecoItemLike> {
  key: string;
  seedTitle?: string;
  items: readonly T[];
}

export interface TvRecoPageLike<T extends TvRecoItemLike> {
  state: "disabled" | "cold" | "warming" | "ready";
  generating: boolean;
  refining: boolean;
  rows: readonly TvRecoRowLike<T>[];
}

export interface TvRecoShelf<T extends TvRecoItemLike> {
  key: string;
  seedTitle?: string;
  items: T[];
}

/** Une étagère plus longue ne se parcourt plus : on ne la dessine pas. */
export const TV_RECO_SHELF_MAX = 24;
/** Assez de titres pour une vraie rangée ; en deçà, ils rejoignent la suivante. */
export const TV_RECO_SHELF_MIN = 3;

/** Les rangées dont le héros se tire, dans l'ordre de préférence. */
const HERO_ROWS = ["forYou", "inLibrary", "bestOfLibrary"];

const inLibrary = <T extends TvRecoItemLike>(item: T): item is T & { jellyfinItemId: string } =>
  item.jellyfinItemId !== null;

/** L'identité d'un titre sur la page : son item s'il est là, sa clé sinon. */
const identityOf = (item: TvRecoItemLike): string => item.jellyfinItemId ?? `key:${item.key}`;

/**
 * Le titre mis en tête de page : le mieux classé de « Pour vous » qui soit
 * dans la bibliothèque, à défaut celui des rangées de la bibliothèque. Stable
 * pour une même page — la tête ne tourne pas sous les yeux.
 */
export function tvRecoHero<T extends TvRecoItemLike>(page: TvRecoPageLike<T> | undefined): T | null {
  if (!page) return null;
  for (const key of HERO_ROWS) {
    const row = page.rows.find((r) => r.key === key);
    const hit = row?.items.find(inLibrary);
    if (hit) return hit;
  }
  for (const row of page.rows) {
    const hit = row.items.find(inLibrary);
    if (hit) return hit;
  }
  return null;
}

/**
 * Les étagères, dans l'ordre servi : bibliothèque seule — plus les titres
 * hors bibliothèque si `external` (la TV sait les demander) —, sans doublon
 * (le héros compris), bornées à `TV_RECO_SHELF_MAX`. Une rangée tombée sous
 * `TV_RECO_SHELF_MIN` disparaît — sauf s'il ne reste qu'elle.
 */
export function tvRecoShelves<T extends TvRecoItemLike>(
  page: TvRecoPageLike<T> | undefined,
  { hero = null, max = TV_RECO_SHELF_MAX, external = false }: { hero?: T | null; max?: number; external?: boolean } = {},
): TvRecoShelf<T>[] {
  if (!page) return [];
  const seen = new Set<string>();
  if (hero) seen.add(identityOf(hero));
  const shelves: TvRecoShelf<T>[] = [];
  for (const row of page.rows) {
    const items: T[] = [];
    for (const item of row.items) {
      if (!external && !inLibrary(item)) continue;
      const identity = identityOf(item);
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push(item);
      if (items.length >= max) break;
    }
    if (items.length === 0) continue;
    shelves.push({ key: row.key, ...(row.seedTitle ? { seedTitle: row.seedTitle } : {}), items });
  }
  const kept = shelves.filter((shelf) => shelf.items.length >= TV_RECO_SHELF_MIN);
  return kept.length > 0 ? kept : shelves;
}

/** Ce que la page dit d'elle-même, au-dessus des étagères. */
export type TvRecoNotice = "disabled" | "cold" | "preparing" | null;

export function tvRecoNotice<T extends TvRecoItemLike>(
  page: TvRecoPageLike<T> | undefined,
  shelves: readonly TvRecoShelf<T>[],
): TvRecoNotice {
  if (!page) return null;
  if (page.state === "disabled") return "disabled";
  // Rien encore à montrer mais le moteur y travaille : on le dit plutôt
  // qu'une page vide.
  if (shelves.length === 0 && (page.generating || page.refining || page.state === "warming")) return "preparing";
  if (page.state === "cold") return "cold";
  return null;
}
