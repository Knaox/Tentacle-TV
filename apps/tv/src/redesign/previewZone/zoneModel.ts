import { TV_STAGE } from "@tentacle-tv/theme";
import type { CardModel } from "../cards/cardTypes";
import type { HeroModel } from "../hero/heroTypes";
import type { MetaItem } from "../hero/MetaLine";

/**
 * Ce que la ZONE D'APERÇU montre d'un titre (tv-core `cards/previewZone.ts`) :
 * son fond, son logo ou son titre, sa ligne de métadonnées et son synopsis.
 * Une carte en donne AUSSITÔT le fond, le logo, le titre et sa légende ; les
 * détails (genres, durée, synopsis, qualité) arrivent quand son focus a tenu.
 */
export interface PreviewZoneModel {
  /** L'identité du titre : le texte s'échange en fondu quand elle change. */
  key: string;
  title: string;
  logoUri?: string;
  backdropUri?: string;
  kicker?: string;
  /** Pourquoi ce titre est là (« Parce que vous avez aimé … »). */
  reason?: string;
  meta: MetaItem[];
  synopsis?: string;
}

/** Les détails lus quand le focus d'une carte a tenu. */
export interface PreviewZoneDetails {
  meta: MetaItem[];
  synopsis?: string;
}

/** La zone, sur la scène (1920 × 1080). */
export const ZONE = {
  /** La hauteur de la zone : la page commence dessous. */
  height: 432,
  /** Le fond et la vidéo, en haut à droite : ils débordent sous la zone, fondus vers le noir. */
  media: { width: 1280, height: 720 },
  /** Le texte, aligné sur le contenu des pages, jamais au-dessus de la marge sûre. */
  left: TV_STAGE.contentLeft,
  top: TV_STAGE.safe.y,
  textWidth: 860,
  /** Le bas du texte : au-dessus du bord de la zone, ou des boutons du héros. */
  bottom: 40,
  heroActions: 68,
  heroActionsGap: 22,
  right: TV_STAGE.safe.x,
} as const;

/** Une carte, tout de suite : ce qu'elle porte déjà ; ses détails s'y ajoutent quand ils arrivent. */
export function zoneModelOfCard(card: CardModel, details: PreviewZoneDetails | null): PreviewZoneModel {
  return {
    key: `card:${card.id}`,
    title: card.title,
    logoUri: card.billboard?.logoUri ?? card.logoUri,
    backdropUri: card.billboard?.backdropUri ?? card.landscapeUri ?? card.posterUri,
    reason: card.focusNote,
    meta: details?.meta.length ? details.meta : card.subtitle ? [card.subtitle] : [],
    synopsis: details?.synopsis,
  };
}

/** Le héros de l'Accueil : il porte déjà tout. */
export function zoneModelOfHero(hero: HeroModel): PreviewZoneModel {
  return {
    key: `hero:${hero.id}`,
    title: hero.title,
    logoUri: hero.logoUri,
    backdropUri: hero.backdropUri,
    kicker: hero.kicker,
    reason: hero.reason,
    meta: hero.meta,
    synopsis: hero.synopsis,
  };
}
