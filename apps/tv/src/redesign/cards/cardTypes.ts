import type { CardMarkers, CardStatusKind } from "@tentacle-tv/shared";
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
   *  recommandation (« Parce que vous avez aimé … »). Rendue par `MorphCard`. */
  focusNote?: string;
  /** La lumière de l'œuvre, pour le fond quand la carte a le focus. */
  palette?: ArtworkPalette;
  /**
   * Le plateau du FOCUS — le survol du bureau, posé sur la carte : les
   * étoiles, puis la capsule d'actions (`cards/tray/CardTray`). Résolu par
   * l'intégration pour la carte qui a le focus : ses crochets d'état
   * (`useCardToggles`, `useCardRatingTarget`…) n'ont pas à tourner sur
   * quatre-vingts cartes. Absent : la carte n'a que son agrandissement et
   * ses marqueurs, comme avant.
   */
  tray?: CardTrayModel;
}

export const EMPTY_MARKERS: CardMarkers = { communityRating: null, userScore: null, statuses: [], device: null };

/**
 * Ce que fait un bouton du plateau : les actions du modèle partagé
 * (`cardTrayEntries`, `externalCardActionEntries`) — sans « garder hors
 * ligne », qu'aucun téléviseur ne fait.
 */
export type CardTrayActionKind = "play" | "request" | CardStatusKind | "details" | "dismiss";

export interface CardTrayAction {
  kind: CardTrayActionKind;
  /** Le libellé résolu : ce que fera le geste (« Retirer de ma liste », « Demander »). */
  label: string;
  /** Le complément de la lecture : l'épisode (S02E05), la position (12:34). */
  detail?: string | null;
  /** Une bascule posée : son glyphe se remplit. */
  active?: boolean;
  /** « Demander » en route : une roue à la place du glyphe, le geste ne répond plus. */
  busy?: boolean;
}

export interface CardTrayRating {
  /** La note posée, sur 10 ; `null` : aucune. */
  current: number | null;
  /** Ce que notent les étoiles se résout encore (la série d'un épisode) :
   *  la place est gardée, le plateau ne saute pas. */
  pending?: boolean;
}

/**
 * Le plateau d'une carte, tel que l'intégration le résout pour la carte qui a
 * le focus :
 * - `actions` : `cardTrayEntries(resolveCardOverlay({ variant, inLibrary,
 *   playable, resume, rateable, offline: false }), useCardToggles(face).states)`
 *   — « Lire » n'y est qu'où OK ne lit pas (`playInTray`) —, ou
 *   `externalCardActionEntries` pour un titre hors bibliothèque (« Demander »
 *   en tête) ; libellés par `t("cards:" + labelKey)`, `detail` par
 *   `useCardSheetPlay` ;
 * - `rating` : quand `overlay.rate` — la note par `useTVUserScore`, `pending`
 *   tant que `useCardRatingTarget` résout la série ;
 * - `onAction` : lecture, bascules (le plateau reste, ses glyphes basculent
 *   sous les yeux), fiche, refus, demande ; `onRate(étoiles)` : note =
 *   étoiles × 2, l'étoile de la note actuelle la retire.
 */
export interface CardTrayModel {
  actions: CardTrayAction[];
  rating?: CardTrayRating | null;
  onAction?: (kind: CardTrayActionKind) => void;
  onRate?: (stars: number) => void;
}
