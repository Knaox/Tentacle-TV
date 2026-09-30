import type { QualityPreset } from "@tentacle-tv/shared";
import type { TVPlayerViewProps } from "../../components/player/TVPlayerView";
import type { PrismStep } from "../../hooks/useTVPrismProgress";

/**
 * Ce que l'écran du lecteur donne à l'habillage refondu : EXACTEMENT ce qu'il
 * donne à l'actuel (`TVPlayerViewProps`) — l'orchestration reste une, seul le
 * rendu change —, plus ce que la refonte montre et que l'actuel taisait.
 */
export interface PlayerRedesignStageProps extends Omit<TVPlayerViewProps, "streamUrl"> {
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
}
