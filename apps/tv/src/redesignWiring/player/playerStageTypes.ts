import type { QualityPreset } from "@tentacle-tv/shared";
import type { TVPlayerViewProps } from "../../components/player/TVPlayerView";
import type { ScrubCountdownState } from "../../hooks/scrubCountdown";
import type { PrismStep } from "../../hooks/useTVPrismProgress";

/**
 * Ce que l'écran du lecteur donne à l'habillage refondu : EXACTEMENT ce qu'il
 * donne à l'actuel (`TVPlayerViewProps`) — l'orchestration reste une, seul le
 * rendu change —, plus ce que la refonte montre et que l'actuel taisait.
 */
export interface PlayerRedesignStageProps extends Omit<TVPlayerViewProps, "streamUrl" | "controls"> {
  /** Les contrôles de l'actuel, plus le décompte du défilement — l'écran passe
   *  déjà tout `useTVPlayerControls` ; l'habillage d'Android TV ne le lit pas. */
  controls: TVPlayerViewProps["controls"] & { scrubCountdown: ScrubCountdownState | null };
  /** Null tant que le flux n'est pas résolu : l'écran de chargement couvre tout. */
  streamUrl: string | null;
  /** La résolution du flux a échoué : « Réessayer ». */
  failed: boolean;
  /** Le jalon PrismCore en cours (tvOS), pendant la résolution. */
  prismStep: PrismStep | null;
  onRetry: () => void;
  /** Les durées RÉELLES des minuteurs de l'arbitre (saut, suite). */
  countdownTotals: { skipMs: number; nextMs: number };
  /** Les paliers de qualité proposés pour ce fichier. */
  qualityPresets: readonly QualityPreset[];
  /** Ce que la pile de couches du Retour lit de l'orchestration (Apple TV). */
  back?: PlayerBackSource;
}

/** Le Retour du lecteur, côté orchestration (`useTVPlayerBack`, `useTVPlayerControls`). */
export interface PlayerBackSource {
  /** Un état passager prend le prochain Retour : défilement, carte « à
   *  suivre », passage automatique refusable, grâce après un Retour pris. */
  transient: boolean;
  /** Le routage partagé de ces états passagers. */
  routeBack: () => boolean;
  /** Masque l'habillage, la lecture continue. */
  hideOverlay: () => void;
}
