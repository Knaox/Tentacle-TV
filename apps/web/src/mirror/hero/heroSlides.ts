import type { ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Le modèle de diapositive de la bannière d'accueil (`hero/heroSlides.ts` et
 * `hero/heroImages.ts` de l'app), recopié tel quel : le bandeau ne sait pas ce
 * qu'il montre — pile d'images, halo, pagination et rotation sont à lui ; le
 * bloc texte/CTA appartient à la diapositive. Module PUR, testé sans DOM.
 */
export interface HeroSlide {
  /** Clé stable (Id Jellyfin, clé reco « movie:603 »). */
  id: string;
  /** Visuel large plein cadre ; null = aplat + voiles, jamais d'image cassée. */
  backdropUri: string | null;
  /** Source minuscule du halo (l'image active, floutée). */
  haloUri: string | null;
  /** L'affiche, pour une carte plus haute que large (téléphone en portrait). */
  posterUri?: string | null;
  /** Source du halo quand la carte montre l'affiche. */
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

/** Le strict nécessaire du client Jellyfin : ce module reste pur. */
export interface HeroImageClient {
  getImageUrl: (itemId: string, type: "Primary" | "Backdrop", opts?: { width?: number; quality?: number }) => string;
}

/** Visuel large : le backdrop (celui de la série pour un épisode), sinon l'affiche. */
export function heroImageUrl(client: HeroImageClient, it: MediaItem, width = 1280, quality = 85): string | null {
  const isEp = it.Type === "Episode";
  const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
  if (!hasParentBackdrop && !hasOwnBackdrop && !it.ImageTags?.Primary) return null;
  const backdropId = isEp ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id) : it.Id;
  return hasParentBackdrop || hasOwnBackdrop
    ? client.getImageUrl(backdropId, "Backdrop", { width, quality })
    : client.getImageUrl(it.Id, "Primary", { width, quality });
}

/** L'affiche 2/3 ; un épisode prend celle de SA SÉRIE (sa Primary est un 16/9). */
export function heroPosterUrl(client: HeroImageClient, it: MediaItem, width = 1080, quality = 85): string | null {
  if (it.Type === "Episode") {
    return it.SeriesId && it.SeriesPrimaryImageTag
      ? client.getImageUrl(it.SeriesId, "Primary", { width, quality })
      : null;
  }
  return it.ImageTags?.Primary ? client.getImageUrl(it.Id, "Primary", { width, quality }) : null;
}

/** Durées de la bannière (`HeroBackdropStack` de l'app) : la diapositive
 *  suivante arrive quand le zoom 1 → 1,06 finit. */
export const HERO_ROTATE_MS = 8000;
export const HERO_FADE_MS = 1200;
export const HERO_ZOOM_TARGET = 1.06;
/** Largeur de la source du halo : le flou mange le détail (cf. AmbilightLayer). */
export const HALO_SOURCE_WIDTH = 128;

/** Index de page d'un défilement horizontal paginé, borné aux diapositives. */
export function pageIndex(scrollLeft: number, slideW: number, count: number): number {
  if (slideW <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / slideW)));
}
