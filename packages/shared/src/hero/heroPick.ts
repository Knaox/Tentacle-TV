import type { MediaItem } from "../types/media";
import { hasHeroImage } from "./heroImage";

/** Le mode du héros que le compte a choisi (`/api/preferences/home-layout`). */
export type HeroMediaMode = "resume" | "random" | "fixed" | "reco";

/** Titres au plus dans la bannière — au-delà, le carrousel dilue plus qu'il ne montre. */
export const HERO_MEDIA_MAX = 5;

/** Chaque source : `undefined` tant qu'elle n'a pas répondu ; une source EN
 *  ÉCHEC vaut une liste vide (elle ne s'attend plus). */
export interface HeroMediaInputs {
  resume: readonly MediaItem[] | undefined;
  featured: readonly MediaItem[] | undefined;
  /** Le titre fixe ; `null` : aucun, introuvable (404) ou en échec. */
  fixed: MediaItem | null | undefined;
}

export interface HeroMediaPick {
  items: MediaItem[];
  /** Ce que le mode attend n'a pas encore répondu : le squelette, pas un vide. */
  pending: boolean;
}

const withImage = (items: readonly MediaItem[] | undefined): MediaItem[] | undefined =>
  items?.filter(hasHeroImage);

/** Le repli de tout mode : la reprise, sinon la sélection du serveur — titres avec image seulement. */
function fallback(inputs: HeroMediaInputs, max: number): HeroMediaPick {
  // La reprise d'abord, comme la TV : tant qu'elle n'a pas répondu, on
  // l'attend — la sélection montrée puis remplacée sauterait sous les yeux.
  const resume = withImage(inputs.resume);
  if (resume === undefined) return { items: [], pending: true };
  if (resume.length > 0) return { items: resume.slice(0, max), pending: false };
  const featured = withImage(inputs.featured);
  if (featured === undefined) return { items: [], pending: true };
  return { items: featured.slice(0, max), pending: false };
}

/**
 * Les titres Jellyfin de la bannière d'accueil — web, bureau, miroir et
 * mobile, aux règles de la TV (tv-core `heroSource`) :
 *
 * - `resume` (et `reco` sans recommandation à montrer) : la reprise, sinon
 *   la sélection du serveur ;
 * - `random` : la sélection du serveur, sinon la reprise ;
 * - `fixed` : le titre choisi, sinon le repli.
 *
 * Deux gardes, payées par une bannière NOIRE (titre fixe effacé de
 * Jellyfin : un 404, donc aucun titre, et la bannière rendait un cadre vide) :
 * un mode qui n'a rien à montrer retombe sur le repli, et un titre sans
 * AUCUNE image annoncée n'est jamais choisi (Jellyfin 10.11 ignore le filtre
 * `HasBackdrop` de la sélection — mesuré). Une liste vide et `pending` à
 * faux : il n'y a rien du tout, la bannière se retire.
 */
export function pickHeroMedia(mode: HeroMediaMode, inputs: HeroMediaInputs, max = HERO_MEDIA_MAX): HeroMediaPick {
  if (mode === "fixed") {
    if (inputs.fixed && hasHeroImage(inputs.fixed)) return { items: [inputs.fixed], pending: false };
    if (inputs.fixed === undefined) return { items: [], pending: true };
    return fallback(inputs, max);
  }
  if (mode === "random") {
    const featured = withImage(inputs.featured);
    if (featured === undefined) return { items: [], pending: true };
    if (featured.length > 0) return { items: featured.slice(0, max), pending: false };
    return fallback(inputs, max);
  }
  return fallback(inputs, max);
}
