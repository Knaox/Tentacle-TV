import type { ReactNode } from "react";

/**
 * Une diapositive du bandeau d'accueil, indépendante de ce qu'elle montre
 * (titre Jellyfin, recommandation…). Le bandeau ne connaît que ce modèle : la
 * pile d'images, le halo, la pagination et la rotation sont à lui ; le bloc
 * texte/CTA appartient à la diapositive.
 */
export interface HeroSlide {
  /** Clé stable (Id Jellyfin, clé reco « movie:603 ») — liste et crossfade. */
  id: string;
  /** Visuel large plein cadre ; null = aplat + voiles, jamais d'image cassée. */
  backdropUri: string | null;
  /** Source minuscule du halo (l'affiche active, floutée). */
  haloUri: string | null;
  /** Le bloc texte/CTA ; `active` rejoue la cascade d'entrée. */
  render: (active: boolean) => ReactNode;
}
