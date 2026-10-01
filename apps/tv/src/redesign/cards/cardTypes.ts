import type { CardMarkers } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../color/artworkPalette";

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
}

/**
 * Ce que dit le badge d'un titre absent : « Pas dans la bibliothèque », ou —
 * quand le serveur sait demander des titres — l'état de sa demande. Le ton
 * choisit la couleur du texte et le glyphe, jamais le seul porteur du sens.
 */
export type AbsentTone = "neutral" | "pending" | "active" | "ready" | "blocked";

export interface AbsentModel {
  label: string;
  tone: AbsentTone;
  /** 0 à 1 : une demande en cours, sa progression. */
  progress?: number;
}

export const EMPTY_MARKERS: CardMarkers = { communityRating: null, userScore: null, statuses: [], device: null };
