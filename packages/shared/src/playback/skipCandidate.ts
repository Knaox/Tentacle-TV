/**
 * LE candidat de saut — quel bouton, à quelle position, et pour quel geste.
 *
 * Extrait de `overlayArbiter.ts` : la règle d'ÉLIGIBILITÉ de l'enchaînement en a
 * besoin (un passage refusé doit faire taire la carte ET son minuteur), et la
 * laisser dans l'arbitre aurait rendu les deux modules circulaires. Aucune
 * règle n'a changé en chemin.
 */

import { type ResolvedSegment, type SegmentType } from "./segmentTypes";
import { findActiveSegment } from "./segmentWindow";
import type { PlaybackSettings, SegmentSettings } from "./playbackSettings";

export type SkipLabelKey =
  | "skipIntro"
  | "skipRecap"
  | "skipPreview"
  | "skipCredits"
  | "skipToPostCredits"
  | "endPlayback"
  | "goToNextEpisode";

export type SkipAction =
  | { kind: "seek"; toMs: number }
  | { kind: "nextEpisode" }
  | { kind: "endOfPlayback" };

const SKIP_LABELS: Partial<Record<SegmentType, SkipLabelKey>> = {
  Intro: "skipIntro",
  Recap: "skipRecap",
  Preview: "skipPreview",
};

/**
 * Le réglage qui gouverne ce passage.
 *
 * ⚠️ Le générique de fin en a DEUX — un pour les épisodes, un pour les films
 * (voir `playbackSettings.ts`). L'appelant dit lequel : sur un épisode, la
 * fiche « à suivre » occupe déjà le générique ; sur un film il n'y a rien
 * d'autre, et « passer » veut dire rejoindre une scène ou terminer.
 */
export function segmentSettingsFor(
  settings: PlaybackSettings,
  type: SegmentType,
  isEpisode: boolean,
): SegmentSettings | null {
  if (type === "Intro") return settings.intro;
  if (type === "Outro") return isEpisode ? settings.outro : settings.outroFilm;
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

export interface SkipCandidateInput {
  segments: readonly ResolvedSegment[];
  positionMs: number;
  /** La lecture a réellement commencé (première image rendue). */
  hasStarted: boolean;
  isEpisode: boolean;
  hasNextEpisode: boolean;
  settings: PlaybackSettings;
}

export function findSkipCandidate(input: SkipCandidateInput): SkipCandidate | null {
  const active = findActiveSegment(input.segments, input.positionMs, input.hasStarted);
  if (!active) return null;
  const settings = segmentSettingsFor(input.settings, active.type, input.isEpisode);
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
  if (!input.isEpisode) {
    // Film au générique SANS scène derrière : plus rien du tout. « Terminer
    // la lecture » n'apportait rien qu'attendre ne donne pas — l'écran de fin
    // arrive tout seul — et en Watch Together il fermait la lecture d'un
    // membre au milieu de la séance. Demandé explicitement (30.08) : un film
    // n'affiche un bouton QUE s'il y a une scène post-générique à rejoindre ;
    // le générique final d'après la scène se tait pareil.
    return null;
  }
  if (!input.hasNextEpisode) {
    // Dernier épisode : il n'y a RIEN à passer — le générique va jusqu'au
    // bout, et « passer » voudrait dire quitter la lecture. Le libellé le dit
    // donc, au lieu de promettre un saut.
    //
    // Le décompte n'est autorisé que sur le générique FINAL — celui qui
    // reprend après une scène post-générique. Là, tout a été vu, et rester
    // devant des minutes de défilement est le geste qu'on ne veut pas imposer.
    // Sur le générique PRINCIPAL, le bouton reste imposé quel que soit le
    // réglage : un décompte qui ferme la lecture au bout de cinq secondes de
    // générique — sa musique, un plan qu'aucun détecteur n'a vu — ne se
    // rattrape pas.
    return {
      segment: active,
      labelKey: "endPlayback",
      action: { kind: "endOfPlayback" },
      settings: isFinalCredits(input.segments, active) ? settings : { ...settings, action: "button" },
    };
  }
  // Épisode + suivant + générique jusqu'au bout : la carte parle.
  return null;
}

/**
 * Ce générique est-il celui qui REPREND après une scène post-générique ?
 *
 * Le témoin est qu'un autre générique s'est terminé avant lui : la scène a donc
 * déjà été proposée, et vue. Aucune position n'entre en jeu — c'est la
 * structure du média qui répond, pas l'endroit où l'on se trouve.
 */
function isFinalCredits(
  segments: readonly ResolvedSegment[],
  active: ResolvedSegment,
): boolean {
  return segments.some((s) => s.type === "Outro" && s !== active && s.endMs <= active.startMs);
}
