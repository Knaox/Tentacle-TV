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
 *  - l'écran de fin (final) est une autre surface à un autre moment : son
 *    PROPRE réglage (`nextFinalCard`), son PROPRE refus (`finalCard`) —
 *    toujours indépendant du réglage et du refus de la fiche du générique ;
 *  - l'interrupteur admin (autoplay_next_enabled) est une garde serveur sur
 *    l'ENCHAÎNEMENT (carte et écran de fin), pas sur les boutons de saut.
 *
 * Les décomptes eux-mêmes vivent dans les réducteurs (saut : introSkip
 * généralisé ; enchaînement : autoNextEngine) — l'arbitre ne fait que les
 * afficher. `Commercial` est résolu et exposé mais n'a pas de réglage : aucun
 * overlay pour lui tant qu'un réglage n'existe pas.
 */

import { type ResolvedSegment, type SegmentType } from "./segmentTypes";
import type { PlaybackSettings, SegmentSettings } from "./playbackSettings";
import { autoNextEligible, nextEpisodeReachable } from "./nextTriggers";
import { findSkipCandidate, type SkipAction, type SkipLabelKey } from "./skipCandidate";
import type { MutedSegments } from "./skipMuting";

// Les frontières du module n'ont pas bougé pour les appelants : tout ce qui
// vivait ici s'y ré-exporte, seuls les fichiers ont été redécoupés.
export { nextCardTriggerReached, nextEpisodeReachable, autoNextEligible } from "./nextTriggers";
export {
  findSkipCandidate, segmentSettingsFor,
  type SkipAction, type SkipCandidate, type SkipCandidateInput, type SkipLabelKey,
} from "./skipCandidate";

export type PlayerOverlay =
  | { kind: "none" }
  | {
      kind: "skip";
      segmentType: SegmentType;
      labelKey: SkipLabelKey;
      action: SkipAction;
      /** Secondes affichées, null = bouton sans décompte. */
      countdownSeconds: number | null;
      /**
       * La croix a-t-elle encore un office ?
       *
       * Non, une fois le passage mis en sourdine : le bouton ne reparaît alors
       * QUE dans l'habillage, où il n'y a plus rien à refuser — il n'est déjà
       * plus sur l'image. Lui laisser sa croix proposerait de se priver d'un
       * geste sans rien gagner.
       */
      dismissible: boolean;
    }
  | {
      kind: "nextCard";
      countdownSeconds: number | null;
      /** true = écran de fin (le média est terminé), false = carte du générique. */
      final: boolean;
    }
  /**
   * La PILULE « aller à l'épisode suivant » — même bouton que les sauts.
   *
   * Elle existe parce que la fiche ne peut pas tout couvrir : pendant une
   * scène post-générique, la carte se retire pour ne pas couvrir l'image, et
   * pourtant l'accès à la suite doit rester atteignable. Sans elle, sauter le
   * générique d'un média à scène finale faisait DISPARAÎTRE la suite jusqu'à la
   * fin du fichier — le défaut qui a motivé tout ceci.
   *
   * Elle n'a paru un temps QU'AVEC les contrôles, pour ne rien poser sur
   * l'image. C'était une exception de trop : un bouton qu'on n'a pas refusé se
   * montre, comme tous les autres, et se refuse d'une croix. Une fois refusée,
   * elle rejoint la règle commune — plus rien sur l'image nue, et elle reste
   * atteignable le temps de l'habillage, sans croix puisqu'il n'y a plus rien à
   * refuser.
   */
  | { kind: "nextButton"; dismissible: boolean };

export interface OverlayDismissals {
  readonly segments: Partial<Record<SegmentType, boolean>>;
  readonly nextCard: boolean;
  /** Le refus de l'AFFICHE de fin — distinct de celui de la carte/pilule. */
  readonly finalCard: boolean;
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
  /** Bibliothèque du média — seules les règles « avant la fin » la lisent. */
  libraryId?: string | null;
  /** Les contrôles du lecteur sont-ils à l'écran ? (la pilule n'existe que là). */
  controlsVisible?: boolean;
  /**
   * L'utilisateur a demandé à REJOINDRE la scène post-générique.
   *
   * Une intention ponctuelle, que nulle comparaison de position ne rend
   * fidèlement : la fenêtre de la carte se referme sur la cible du saut, donc
   * tout atterrissage imprécis la rouvre. Tant qu'elle tient, la carte se
   * tait — la scène qu'on a choisi de voir ne se fait pas couvrir. La pilule
   * et l'écran de fin, eux, ne sont pas concernés : le premier n'est là qu'avec
   * l'habillage, le second arrive quand il n'y a plus rien à regarder.
   */
  postCreditsClaimed?: boolean;
  /** Garde serveur `autoplay_next_enabled` (admin). */
  serverAutoplayEnabled: boolean;
  /** Les passages mis en sourdine — ils gouvernent la croix, pas l'affichage. */
  mutedSegments?: MutedSegments;
  dismissed: OverlayDismissals;
  /** Décomptes tenus par les réducteurs, déjà en secondes affichables. */
  countdowns: { skip: number | null; next: number | null };
}

function skipOverlay(
  segment: ResolvedSegment,
  settings: SegmentSettings,
  labelKey: SkipLabelKey,
  action: SkipAction,
  countdowns: ArbiterInput["countdowns"],
  dismissible: boolean,
): PlayerOverlay {
  const countdownSeconds =
    settings.action === "auto" && settings.countdownVisible ? countdowns.skip : null;
  return { kind: "skip", segmentType: segment.type, labelKey, action, countdownSeconds, dismissible };
}

export function arbitrateOverlay(input: ArbiterInput): PlayerOverlay {
  const { settings, dismissed, countdowns } = input;

  // 1. Fin de lecture : l'écran de fin — son réglage, son refus, jamais ceux
  //    de la fiche du générique. Quand il ne paraît pas, la SORTIE appartient
  //    au lecteur (`useEndOfPlaybackExit`), pas à l'arbitre.
  if (input.playbackEnded) {
    if (
      input.hasNextEpisode &&
      input.serverAutoplayEnabled &&
      settings.next.nextFinalCard &&
      !dismissed.finalCard
    ) {
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
    return skipOverlay(
      candidate.segment, candidate.settings, candidate.labelKey, candidate.action, countdowns,
      input.mutedSegments?.has(candidate.segment.type) !== true,
    );
  }

  const libraryId = input.libraryId ?? null;
  const chainable =
    input.hasNextEpisode && input.serverAutoplayEnabled && input.hasStarted;

  // 3. La carte « à suivre ».
  // L'éligibilité vient du sélecteur PARTAGÉ avec le minuteur : la carte et le
  // décompte ne peuvent plus se contredire (cf. `autoNextEligible`).
  if (chainable && settings.next.nextCard && !dismissed.nextCard && autoNextEligible(input)) {
    return {
      kind: "nextCard",
      countdownSeconds: settings.next.nextCountdown ? countdowns.next : null,
      final: false,
    };
  }

  // 4. La pilule, quand la carte ne parle pas — fiche éteinte, refusée, ou
  //    simplement hors de sa fenêtre parce qu'une scène post-générique passe.
  if (
    chainable &&
    nextEpisodeReachable(
      input.positionMs,
      input.runtimeMs,
      input.segments,
      settings.next,
      libraryId,
    )
  ) {
    // Le refus de la suite est UN SEUL refus, qu'il vienne de la carte ou de la
    // pilule : les deux disent la même chose, et un utilisateur qui a écarté
    // l'une ne veut pas voir l'autre revenir par la fenêtre.
    const refusedNext = dismissed.nextCard;
    // Un passage REFUSÉ demande le silence, et la pilule le doit aussi : sans
    // cela, croiser « aller à la scène post-générique » faisait surgir « aller
    // à l'épisode suivant » au même endroit, dans la seconde — la croix
    // n'aurait servi à rien. Elle reste atteignable avec l'habillage.
    const hushed = candidate !== null && input.mutedSegments?.has(candidate.segment.type) === true;
    if (!refusedNext && !hushed) return { kind: "nextButton", dismissible: true };
    if (input.controlsVisible === true) {
      return { kind: "nextButton", dismissible: !refusedNext };
    }
  }

  return { kind: "none" };
}
