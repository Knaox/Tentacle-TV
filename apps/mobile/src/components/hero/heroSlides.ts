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
  /** Visuel VERTICAL (l'affiche), pour une carte plus haute que large — le
   *  téléphone en portrait. Un visuel 16/9 y perdait les deux tiers de sa
   *  largeur, et le sujet avec. Absent : la carte garde le visuel large. */
  posterUri?: string | null;
  /** Source minuscule du halo quand la carte montre l'affiche : la lueur
   *  prolonge l'image VISIBLE, pas une autre. */
  haloPosterUri?: string | null;
  /** Le bloc texte/CTA ; `active` rejoue la cascade d'entrée. */
  render: (active: boolean) => ReactNode;
}

/** Le visuel que la carte affiche : l'affiche en portrait si elle existe. */
export function slideVisual(slide: HeroSlide, portrait: boolean): string | null {
  return portrait ? (slide.posterUri ?? slide.backdropUri) : slide.backdropUri;
}

/** La source du halo, assortie au visuel affiché. */
export function slideHalo(slide: HeroSlide, portrait: boolean): string | null {
  if (portrait && slide.posterUri) return slide.haloPosterUri ?? slide.haloUri;
  return slide.haloUri;
}
