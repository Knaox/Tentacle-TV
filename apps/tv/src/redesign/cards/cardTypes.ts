import type { CardMarkers, QualityBadge } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../color/artworkPalette";
import type { ArrivalModel } from "../requests/arrivalTypes";

/**
 * Ce qu'une carte reçoit — DÉJÀ résolu par l'intégration : les marqueurs
 * par le modèle partagé (`resolveCardMarkers` / `useCardMarkers`), la
 * progression par l'état de lecture, les images en adresses prêtes. Une
 * carte ne lit jamais `UserData`.
 */
export interface CardModel {
  id: string;
  title: string;
  /** « S2 · É3 — 18 min restantes », « 2019 », « +3 épisodes »… */
  subtitle?: string;
  /** Image 16:9 (Thumb, Backdrop, ou l'image d'un épisode). */
  landscapeUri?: string;
  /** Affiche 2:3 (Primary). */
  posterUri?: string;
  /** Logo du titre, posé sur l'image 16:9 — à ne fournir que quand cette
   *  image n'en porte pas déjà un (un Backdrop, pas un Thumb). */
  logoUri?: string;
  /** Note globale, note perso, pastille Ma liste · favori · vu. */
  markers: CardMarkers;
  /** 0 à 1 ; absent quand il n'y a rien à reprendre (ou titre vu). */
  progress?: number;
  /** Étiquette en haut à gauche : « +3 », « Découverte ». */
  badge?: string;
  /** La phrase dite sous la carte quand elle a le focus — la raison d'une
   *  recommandation (« Parce que vous avez aimé … »). Rendue sous la légende
   *  d'une affiche (`MediaCard`, `CardFocusNote`) et par `MorphCard`. */
  focusNote?: string;
  /** La lumière de l'œuvre, pour le fond quand la carte a le focus. */
  palette?: ArtworkPalette;
  /** Un titre ABSENT de la bibliothèque : son affiche (TMDB) grisée, et son
   *  badge. Ni marqueurs ni progression : rien de lui n'est dans Jellyfin. */
  absent?: AbsentModel;
  /** La qualité du titre — 4K, Dolby Vision, Dolby Atmos —, montrée au focus
   *  DANS l'image (`CardQualityBadges`). Absente : rien à montrer. */
  quality?: CardQuality;
}

/**
 * Ce qu'une carte sait de la qualité de son titre : ses badges, quand sa liste
 * portait ses flux ; sinon l'identifiant à lire AU FOCUS (`probe`, par la
 * source de l'intégration — `qualityBadgeSource`). Une série n'a que le
 * premier cas : rien ne se demande pour elle.
 */
export type CardQuality = { badges: readonly QualityBadge[] } | { probe: string };

/**
 * Ce que dit le badge d'un titre absent : « Pas dans la bibliothèque », ou —
 * quand le serveur sait demander des titres — l'état de sa demande. Le ton
 * choisit la couleur du texte et le glyphe, jamais le seul porteur du sens.
 */
export type AbsentTone = "neutral" | "pending" | "active" | "ready" | "blocked";

export interface AbsentModel {
  /** Le mot du badge ; pour une demande du compte (`arrival`), le mot de son
   *  état seul — la carte y ajoute le pour cent à l'instant. */
  label: string;
  tone: AbsentTone;
  /** 0 à 1 : une demande en cours, sa progression. */
  progress?: number;
  /** Une demande du COMPTE : l'affiche arrive façon Apple — grise, elle se
   *  colore au prorata de l'avancement, le camembert au centre. */
  arrival?: ArrivalModel;
}

export const EMPTY_MARKERS: CardMarkers = { communityRating: null, userScore: null, statuses: [], device: null };
