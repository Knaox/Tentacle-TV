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
 *  - sans segment Outro connu : repli temporel « X s avant la fin » pour la
 *    carte SEULEMENT — jamais un bouton de saut sans donnée ;
 *  - l'écran de fin (final) est une autre surface à un autre moment : il
 *    ignore le réglage de la fiche, comportement historique conservé ;
 *  - l'interrupteur admin (autoplay_next_enabled) est une garde serveur sur
 *    l'ENCHAÎNEMENT (carte et écran de fin), pas sur les boutons de saut.
 *
 * Les décomptes eux-mêmes vivent dans les réducteurs (saut : sautIntro
 * généralisé ; enchaînement : autoNextEngine) — l'arbitre ne fait que les
 * afficher. `Commercial` est résolu et exposé mais n'a pas de réglage : aucun
 * overlay pour lui tant qu'un réglage n'existe pas.
 */

import { findSegment, type ResolvedSegment, type SegmentType } from "./segmentTypes";
import { findActiveSegment } from "./segmentWindow";
import type { PlaybackSettings, SegmentSettings } from "./playbackSettings";

export type SkipLabelKey =
  | "skipIntro"
  | "skipRecap"
  | "skipPreview"
  | "skipCredits"
  | "skipToPostCredits";

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

function segmentSettingsFor(
  settings: PlaybackSettings,
  type: SegmentType,
): SegmentSettings | null {
  if (type === "Intro") return settings.intro;
  if (type === "Outro") return settings.outro;
  if (type === "Recap") return settings.recap;
  if (type === "Preview") return settings.preview;
  return null; // Commercial : pas de réglage, pas d'overlay.
}

function skipOverlay(
  segment: ResolvedSegment,
  reglage: SegmentSettings,
  labelKey: SkipLabelKey,
  action: SkipAction,
  countdowns: ArbiterInput["countdowns"],
): PlayerOverlay {
  const countdownSeconds =
    reglage.action === "auto" && reglage.countdownVisible ? countdowns.skip : null;
  return { kind: "skip", segmentType: segment.type, labelKey, action, countdownSeconds };
}

/** Le déclencheur de la carte est-il franchi ? */
function nextCardTriggered(input: ArbiterInput): boolean {
  const { positionMs, runtimeMs, settings } = input;
  const outro = findSegment(input.segments, "Outro");

  if (settings.next.nextTrigger === "outroStart" && outro) {
    if (outro.hasContentAfter) {
      // Pendant le générique seulement : la carte ne se pose jamais par-dessus
      // la scène post-générique que l'utilisateur a choisi de garder.
      return positionMs >= outro.startMs && positionMs < outro.endMs;
    }
    return positionMs >= outro.startMs;
  }
  // Repli temporel (aucun Outro connu, ou choix explicite « avant la fin »).
  return runtimeMs > 0 && positionMs >= runtimeMs - settings.next.nextBeforeEndSeconds * 1_000;
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

  // 2. Un segment actif ? Le bouton de saut bat la carte.
  const actif = findActiveSegment(input.segments, input.positionMs, input.hasStarted);
  if (actif && !dismissed.segments[actif.type]) {
    const reglage = segmentSettingsFor(settings, actif.type);
    if (reglage && reglage.action !== "off") {
      if (actif.type !== "Outro") {
        const labelKey = SKIP_LABELS[actif.type];
        if (labelKey) {
          return skipOverlay(actif, reglage, labelKey, { kind: "seek", toMs: actif.endMs }, countdowns);
        }
      } else if (actif.hasContentAfter) {
        // « Passer » = rejoindre la scène post-générique, on reste sur le média.
        return skipOverlay(actif, reglage, "skipToPostCredits", { kind: "seek", toMs: actif.endMs }, countdowns);
      } else if (!input.isEpisode || !input.hasNextEpisode) {
        // Film ou dernier épisode : « passer » = terminer la lecture.
        return skipOverlay(actif, reglage, "skipCredits", { kind: "endOfPlayback" }, countdowns);
      }
      // Épisode + suivant + générique jusqu'au bout : la carte parle (ci-dessous).
    }
  }

  // 3. La carte « à suivre ».
  if (
    settings.next.nextCard &&
    input.hasNextEpisode &&
    input.serverAutoplayEnabled &&
    !dismissed.nextCard &&
    input.hasStarted &&
    nextCardTriggered(input)
  ) {
    return {
      kind: "nextCard",
      countdownSeconds: settings.next.nextCountdown ? countdowns.next : null,
      final: false,
    };
  }

  return { kind: "none" };
}
