import type { HeroMode } from "@tentacle-tv/shared";

/**
 * Réglages › Personnalisation des téléviseurs — la section « Bandeau
 * principal » : une pastille par source proposée (shared `heroModesOffered`),
 * la retenue cochée, et dessous ce qu'elle MONTRE. Ce module décide de ce que
 * fait OK sur une pastille ; la vue et l'intégration ne font qu'appliquer.
 *
 * - une autre source que « Un titre choisi » : elle s'écrit aussitôt (le
 *   compte, donc tous ses appareils) ;
 * - « Un titre choisi » : la liste des favoris s'ouvre (la liste de choix des
 *   réglages, sur le titre retenu) — la source ne s'écrit qu'avec son titre,
 *   jamais un bandeau fixe sans titre ; sans favori, la section le DIT ;
 * - la source déjà retenue : rien (« Changer de titre » rouvre la liste).
 * Module pur.
 */

export type HeroSourcePress =
  | { kind: "save"; mode: HeroMode }
  | { kind: "pickFixed" }
  | { kind: "noFavorites" }
  | { kind: "none" };

export function heroSourcePress(mode: HeroMode, context: { current: HeroMode; favorites: number | null }): HeroSourcePress {
  if (mode === context.current) return { kind: "none" };
  if (mode !== "fixed") return { kind: "save", mode };
  // Les favoris ne sont pas encore lus : la liste s'ouvre quand même, elle se remplit.
  return context.favorites === 0 ? { kind: "noFavorites" } : { kind: "pickFixed" };
}

/** Les pastilles de la section : `settings:hero:<source>`, et « Changer de titre ». */
export const settingsHeroKey = (mode: string): string => `settings:hero:${mode}`;
export const SETTINGS_HERO_CHANGE_FIXED = "settings:hero:changeFixed";
