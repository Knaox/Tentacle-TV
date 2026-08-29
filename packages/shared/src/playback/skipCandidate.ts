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
