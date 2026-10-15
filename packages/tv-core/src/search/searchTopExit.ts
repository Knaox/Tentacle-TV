import { groupEntryKey } from "../focus/groupEntry";

/**
 * BAS depuis le MEILLEUR RÉSULTAT — la bannière en tête des résultats de la
 * recherche (`top`) — vers la rangée qui la suit.
 *
 * La règle commune des sections (`focus/sections.ts`) vise l'élément dont le
 * centre est le plus proche de celui qu'on quitte. La bannière occupe toute la
 * largeur de la colonne : son centre tombe au milieu de la rangée du dessous,
 * et BAS atterrissait sur une carte au milieu, à droite — jamais sur la
 * première (retour d'essai, Apple TV et Android TV, 2026-10-15). La bannière
 * COMMENCE à gauche, comme la rangée : BAS y entre par son début.
 *
 * « Son début », c'est l'entrée d'un groupe (`focus/groupEntry.ts`) : la carte
 * de la rangée qui a eu le focus en dernier, si elle est encore montée et que
 * la rangée n'a pas changé depuis (elle est restée là où on l'a laissée : rien
 * ne défile) ; sinon sa première carte. Les rangées de la recherche ne
 * reviennent jamais au début d'elles-mêmes (aucune n'est déclarée au
 * rembobinage, `focus/rowRewind.ts`) : la carte retenue est celle qui se voit.
 *
 * L'entrée n'est déclarée QUE pendant que la bannière a le focus : elle est
 * l'exception d'un seul geste. HAUT depuis la rangée d'en dessous garde la
 * règle commune (une rangée suit, au plus proche) ; HAUT depuis cette rangée
 * rend la bannière, seul élément de sa section.
 *
 * Les clés : la bannière `top`, ses rangées `section:<rangée>`, leurs éléments
 * `<rangée>:<i>` (cartes, `people:<i>`, `facets:<i>`). Module pur : la
 * plateforme pose l'entrée sur la section (tvOS et Android : `tvEntry`).
 */

/** La clé du meilleur résultat. */
export const SEARCH_TOP_KEY = "top";

/** La clé de section d'une rangée de résultats (`FocusSection`). */
export function searchSectionKey(rowKey: string): string {
  return `section:${rowKey}`;
}

/** La rangée de résultats qui porte `focusKey` (`<rangée>:<i>`), parmi `rowKeys`, ou null. */
export function searchRowOf(focusKey: string | null, rowKeys: readonly string[]): string | null {
  if (!focusKey) return null;
  const cut = focusKey.lastIndexOf(":");
  if (cut <= 0 || !/^\d+$/.test(focusKey.slice(cut + 1))) return null;
  const row = focusKey.slice(0, cut);
  return rowKeys.includes(row) ? row : null;
}

/** Une rangée telle qu'elle est montrée : sa clé, et ce qui change avec ses éléments (son modèle). */
export interface SearchRowVersion {
  key: string;
  version: unknown;
}

/**
 * La MÉMOIRE des rangées : le dernier élément visité de chacune, oublié dès
 * que la rangée change (une autre réponse, d'autres cartes) ou disparaît.
 */
export interface SearchRowMemory {
  /** Les rangées montrées : celles qui ont changé ou disparu sont oubliées. */
  sync(rows: readonly SearchRowVersion[]): void;
  /** Un focus posé : retenu s'il est dans une rangée montrée. */
  visit(focusKey: string): void;
  /** Le dernier élément visité de la rangée, ou null. */
  last(rowKey: string): string | null;
}

export function createSearchRowMemory(): SearchRowMemory {
  const versions = new Map<string, unknown>();
  const visited = new Map<string, string>();
  return {
    sync(rows) {
      const shown = new Set(rows.map((row) => row.key));
      for (const key of [...versions.keys()]) {
        if (!shown.has(key)) {
          versions.delete(key);
          visited.delete(key);
        }
      }
      for (const row of rows) {
        if (versions.has(row.key) && versions.get(row.key) !== row.version) visited.delete(row.key);
        versions.set(row.key, row.version);
      }
    },
    visit(focusKey) {
      const row = searchRowOf(focusKey, [...versions.keys()]);
      if (row) visited.set(row, focusKey);
    },
    last: (rowKey) => visited.get(rowKey) ?? null,
  };
}

export interface SearchTopExitInput {
  /** Les rangées dans leur ordre d'affichage (`tvSearchSections`). */
  rowKeys: readonly string[];
  /** La clé qui porte le focus. */
  focusedKey: string | null;
  /** Le dernier élément visité d'une rangée (la mémoire). */
  last: (rowKey: string) => string | null;
  isMounted: (focusKey: string) => boolean;
}

/** L'entrée à déclarer : sur quelle section, quel élément. */
export interface SearchTopExit {
  section: string;
  entry: string;
}

/**
 * L'entrée de la rangée sous le meilleur résultat, tant que la bannière a le
 * focus ; null sinon (aucune entrée : la règle commune).
 */
export function searchTopExit({ rowKeys, focusedKey, last, isMounted }: SearchTopExitInput): SearchTopExit | null {
  if (focusedKey !== SEARCH_TOP_KEY || rowKeys[0] !== SEARCH_TOP_KEY) return null;
  const below = rowKeys[1];
  if (below === undefined) return null;
  const entry = groupEntryKey({ remember: true, last: last(below), isMounted, fallback: () => `${below}:0` });
  return entry ? { section: searchSectionKey(below), entry } : null;
}
