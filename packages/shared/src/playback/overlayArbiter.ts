/**
 * L'arbitre d'overlay : UN SEUL overlay à la fois, décidé au même endroit
 * pour les six surfaces. C'est lui qui remplace les conditions booléennes
 * dispersées (« !autoPlayCountdown && !hasNextEpisode »…) des cinq lecteurs.
 *
 * Règles validées :
 *  - priorité : bouton de saut > carte épisode suivant ;
 *  - le bouton de GÉNÉRIQUE n'apparaît que quand « passer » veut dire autre
 *    chose qu'« épisode suivant » — scène post-générique (seek à la fin du
 *    segment, jamais au-delà), film, ou pas d'épisode suivant. Sinon la CARTE
 *    occupe seule le générique, dès son début ;
 *  - quitter la lecture n'est PAS un saut : sur un film, le bouton porte son
 *    vrai libellé (« Terminer ») et reste manuel, réglage ou pas ;
 *  - sans segment Outro connu : repli temporel « X s avant la fin » pour la
 *    carte SEULEMENT — jamais un bouton de saut sans donnée ;
 *  - l'écran de fin (final) est une autre surface à un autre moment : il
 *    ignore le réglage de la fiche, comportement historique conservé ;
 *  - l'interrupteur admin (autoplay_next_enabled) est une garde serveur sur
 *    l'ENCHAÎNEMENT (carte et écran de fin), pas sur les boutons de saut.
 *
 * Les décomptes eux-mêmes vivent dans les réducteurs (saut : introSkip
 * généralisé ; enchaînement : autoNextEngine) — l'arbitre ne fait que les
 * afficher. `Commercial` est résolu et exposé mais n'a pas de réglage : aucun
 * overlay pour lui tant qu'un réglage n'existe pas.
 */

import { findSegments, type ResolvedSegment, type SegmentType } from "./segmentTypes";
import { findActiveSegment } from "./segmentWindow";
import {
  beforeEndPositionMs,
  resolveBeforeEnd,
  type PlaybackSettings,
  type SegmentSettings,
} from "./playbackSettings";

export type SkipLabelKey =
  | "skipIntro"
  | "skipRecap"
  | "skipPreview"
  | "skipCredits"
  | "skipToPostCredits"
  | "endPlayback";

export type SkipAction =
  | { kind: "seek"; toMs: number }
  | { kind: "nextEpisode" }
  | { kind: "endOfPlayback" };

export type PlayerOverlay =
  | { kind: "none" }
  | {
      kind: "skip";
      segmentType: SegmentType;
      labelKey: SkipLabelKey;
      action: SkipAction;
      /** Secondes affichées, null = bouton sans décompte. */
      countdownSeconds: number | null;
    }
  | {
      kind: "nextCard";
      countdownSeconds: number | null;
      /** true = écran de fin (le média est terminé), false = carte du générique. */
      final: boolean;
    };

export interface OverlayDismissals {
  readonly segments: Partial<Record<SegmentType, boolean>>;
  readonly nextCard: boolean;
}

export interface ArbiterInput {
  positionMs: number;
  runtimeMs: number;
  hasStarted: boolean;
  /** La lecture est ARRIVÉE au bout (EOF), pas simplement en pause. */
  playbackEnded: boolean;
  segments: readonly ResolvedSegment[];
  isEpisode: boolean;
  hasNextEpisode: boolean;
  settings: PlaybackSettings;
  /** Garde serveur `autoplay_next_enabled` (admin). */
  serverAutoplayEnabled: boolean;
  dismissed: OverlayDismissals;
  /** Décomptes tenus par les réducteurs, déjà en secondes affichables. */
  countdowns: { skip: number | null; next: number | null };
}

const SKIP_LABELS: Partial<Record<SegmentType, SkipLabelKey>> = {
  Intro: "skipIntro",
  Recap: "skipRecap",
  Preview: "skipPreview",
};

export function segmentSettingsFor(
  settings: PlaybackSettings,
  type: SegmentType,
): SegmentSettings | null {
  if (type === "Intro") return settings.intro;
  if (type === "Outro") return settings.outro;
  if (type === "Recap") return settings.recap;
  if (type === "Preview") return settings.preview;
  return null; // Commercial : pas de réglage, pas d'overlay.
}

/** Un bouton de saut candidat — AVANT refus et décompte (la coquille de
 *  lecture s'en sert pour piloter le réducteur sans redire ces règles). */
export interface SkipCandidate {
  segment: ResolvedSegment;
  labelKey: SkipLabelKey;
  action: SkipAction;
  settings: SegmentSettings;
}

export type SkipCandidateInput = Pick<
  ArbiterInput,
  "segments" | "positionMs" | "hasStarted" | "isEpisode" | "hasNextEpisode" | "settings"
>;

export function findSkipCandidate(input: SkipCandidateInput): SkipCandidate | null {
  const active = findActiveSegment(input.segments, input.positionMs, input.hasStarted);
  if (!active) return null;
  const settings = segmentSettingsFor(input.settings, active.type);
  if (!settings || settings.action === "off") return null;

  if (active.type !== "Outro") {
    const labelKey = SKIP_LABELS[active.type];
    if (!labelKey) return null;
    return { segment: active, labelKey, action: { kind: "seek", toMs: active.endMs }, settings };
  }
  if (active.hasContentAfter) {
    // « Passer » = rejoindre la scène post-générique, on reste sur le média.
    return {
      segment: active,
      labelKey: "skipToPostCredits",
      action: { kind: "seek", toMs: active.endMs },
      settings,
    };
  }
  if (!input.isEpisode || !input.hasNextEpisode) {
    // Film ou dernier épisode : il n'y a RIEN à passer — le générique va
    // jusqu'au bout, et « passer » voudrait dire quitter la lecture. Le
    // libellé le dit donc, au lieu de promettre un saut (c'est ainsi qu'une
    // scène post-générique Marvel se perdait : le bouton disait « passer le
    // générique » et fermait le film).
    //
    // Et jamais en automatique, quel que soit le réglage : un décompte qui
    // quitte le film tout seul au bout de trois secondes de générique est
    // exactement le geste qu'on ne peut pas rattraper. `action: "button"` est
    // imposé ici, pas lu.
    return {
      segment: active,
      labelKey: "endPlayback",
      action: { kind: "endOfPlayback" },
      settings: { ...settings, action: "button" },
    };
  }
  // Épisode + suivant + générique jusqu'au bout : la carte parle.
  return null;
}

function skipOverlay(
  segment: ResolvedSegment,
  settings: SegmentSettings,
  labelKey: SkipLabelKey,
  action: SkipAction,
  countdowns: ArbiterInput["countdowns"],
): PlayerOverlay {
  const countdownSeconds =
    settings.action === "auto" && settings.countdownVisible ? countdowns.skip : null;
  return { kind: "skip", segmentType: segment.type, labelKey, action, countdownSeconds };
}

/**
 * Le déclencheur de la carte est-il franchi ? Sert aussi d'« éligibilité » au
 * moteur d'enchaînement — même sélecteur, aucune divergence possible.
 *
 * # L'ordre de confiance
 *
 * 1. Un SECOND générique après la scène post-générique (le modèle Plex :
 *    générique → scène → générique final). C'est la donnée la plus sûre qui
 *    existe, elle bat toute heuristique.
 * 2. Le générique principal. S'il porte une scène derrière lui, la fenêtre
 *    s'arrête à sa fin : la carte ne se pose JAMAIS par-dessus une scène que
 *    l'utilisateur a choisi de garder. (Le trou qui s'ouvre alors est comblé
 *    par la pilule « épisode suivant », pas par la carte.)
 * 3. À défaut de tout générique, le repli temporel de la bibliothèque.
 *
 * Le repli ne s'applique donc JAMAIS quand un générique est connu — c'est ce
 * qui empêche par construction les deux de se marcher dessus. Un utilisateur
 * peut passer outre avec `nextTrigger: "beforeEnd"`, et l'interface le dit.
 */
export function nextCardTriggerReached(
  positionMs: number,
  runtimeMs: number,
  segments: readonly ResolvedSegment[],
  next: PlaybackSettings["next"],
  libraryId: string | null = null,
): boolean {
  const outros = findSegments(segments, "Outro");

  if (outros.length > 0 && next.nextTrigger === "outroStart") {
    const main = outros[0];
    const final = outros.length > 1 ? outros[outros.length - 1] : null;
    if (final && positionMs >= final.startMs) return true;
    if (main.hasContentAfter) return positionMs >= main.startMs && positionMs < main.endMs;
    return positionMs >= main.startMs;
  }

  const target = resolveBeforeEnd(next, libraryId);
  if (!target) return false;
  const threshold = beforeEndPositionMs(target, runtimeMs);
  return threshold !== null && positionMs >= threshold;
}

export function arbitrateOverlay(input: ArbiterInput): PlayerOverlay {
  const { settings, dismissed, countdowns } = input;

  // 1. Fin de lecture : l'écran de fin, indépendant du réglage de la fiche.
  if (input.playbackEnded) {
    if (input.hasNextEpisode && input.serverAutoplayEnabled && !dismissed.nextCard) {
      return {
        kind: "nextCard",
        countdownSeconds: settings.next.nextCountdown ? countdowns.next : null,
        final: true,
      };
    }
    return { kind: "none" };
  }

  // 2. Un bouton de saut candidat ? Il bat la carte — sauf refus du passage.
  const candidate = findSkipCandidate(input);
  if (candidate && !dismissed.segments[candidate.segment.type]) {
    return skipOverlay(candidate.segment, candidate.settings, candidate.labelKey, candidate.action, countdowns);
  }

  // 3. La carte « à suivre ».
  if (
    settings.next.nextCard &&
    input.hasNextEpisode &&
    input.serverAutoplayEnabled &&
    !dismissed.nextCard &&
    input.hasStarted &&
    nextCardTriggerReached(input.positionMs, input.runtimeMs, input.segments, settings.next)
  ) {
    return {
      kind: "nextCard",
      countdownSeconds: settings.next.nextCountdown ? countdowns.next : null,
      final: false,
    };
  }

  return { kind: "none" };
}
