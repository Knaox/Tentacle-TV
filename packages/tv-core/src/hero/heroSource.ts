import { HERO_MAX_ITEMS } from "./rotation";

/**
 * D'OÙ VIENNENT les titres du héros de l'accueil : le mode que le compte a
 * choisi et que le SERVEUR garde (`/api/preferences/home-layout` ›
 * `heroMode`, `heroFixedItemId`) — le même que le web, le bureau et le
 * mobile (`useHomeHero` de chacun), aux mêmes règles :
 *
 * - `resume` : les visionnages à reprendre, sinon la sélection du serveur ;
 * - `random` : la sélection du serveur ;
 * - `fixed` : le titre choisi ;
 * - `reco` : un tirage de « Pour vous » (sur la TV : les titres EN
 *   bibliothèque seulement — rien à demander à trois mètres).
 *
 * Un mode qui n'a rien à montrer (titre fixe disparu, « Pour vous » vide)
 * retombe sur `resume` : jamais un héros vide. Ce que le mode attend se
 * DIT (`null`) : l'accueil ne se montre pas avec un héros qui sauterait
 * ensuite. Au-delà de `HERO_SOURCE_WAIT_MS`, l'attente cesse (`waitedOut`) :
 * une recommandation lente cède la place à la reprise. Et un héros déjà
 * montré garde sa source tant que le mode ne change pas (`previous`) : une
 * page de recommandations arrivée après coup ne remplace rien sous les yeux.
 * Module pur.
 */

export type HeroMode = "resume" | "random" | "reco" | "fixed";
export type HeroSource = "resume" | "featured" | "fixed" | "reco";

/** L'attente bornée d'une source lente (la page de recommandations, le titre fixe). */
export const HERO_SOURCE_WAIT_MS = 2_500;

/** Chaque source : `undefined` tant qu'elle n'a pas répondu. */
export interface HeroInputs<T> {
  resume: readonly T[] | undefined;
  featured: readonly T[] | undefined;
  /** Le titre fixe ; `null` : aucun, ou introuvable. */
  fixed: T | null | undefined;
  /** Les titres de « Pour vous » déjà tirés et résolus. */
  reco: readonly T[] | undefined;
}

export interface HeroSourceOptions {
  /** L'attente bornée est échue : une source lente vaut « rien ». */
  waitedOut?: boolean;
  /** La source déjà montrée, et le mode qui l'a choisie. */
  previous?: { mode: HeroMode; source: HeroSource } | null;
}

function itemsOf<T>(source: HeroSource, inputs: HeroInputs<T>): readonly T[] {
  switch (source) {
    case "resume":
      return inputs.resume ?? [];
    case "featured":
      return inputs.featured ?? [];
    case "fixed":
      return inputs.fixed ? [inputs.fixed] : [];
    case "reco":
      return inputs.reco ?? [];
  }
}

/** Le repli de tout mode : la reprise, sinon la sélection du serveur. */
function fallbackOf<T>(inputs: HeroInputs<T>): HeroSource | null {
  if (inputs.resume === undefined) return null;
  if (inputs.resume.length > 0) return "resume";
  return inputs.featured === undefined ? null : "featured";
}

/**
 * La source du héros pour `mode` ; `null` : elle n'est pas encore connue (le
 * mode lui-même, `null`, ou ce qu'il attend).
 */
export function heroSourceFor<T>(mode: HeroMode | null, inputs: HeroInputs<T>, options: HeroSourceOptions = {}): HeroSource | null {
  if (mode === null) return null;
  const { previous, waitedOut = false } = options;
  if (previous && previous.mode === mode && itemsOf(previous.source, inputs).length > 0) return previous.source;
  switch (mode) {
    case "random":
      return inputs.featured === undefined ? null : "featured";
    case "fixed":
      if (inputs.fixed) return "fixed";
      return inputs.fixed === undefined && !waitedOut ? null : fallbackOf(inputs);
    case "reco":
      if (inputs.reco && inputs.reco.length > 0) return "reco";
      return inputs.reco === undefined && !waitedOut ? null : fallbackOf(inputs);
    case "resume":
      return fallbackOf(inputs);
  }
}

/** Les titres de la source : `HERO_MAX_ITEMS` au plus. */
export function heroItemsFrom<T>(source: HeroSource | null, inputs: HeroInputs<T>): T[] {
  return source ? itemsOf(source, inputs).slice(0, HERO_MAX_ITEMS) : [];
}

/** Le mode lu du serveur ; une mise en page illisible ou en échec : `resume`, comme le web. */
export function heroModeOf(layout: { heroMode?: string } | undefined, failed: boolean): HeroMode | null {
  const mode = layout?.heroMode;
  if (mode === "resume" || mode === "random" || mode === "reco" || mode === "fixed") return mode;
  return layout || failed ? "resume" : null;
}
