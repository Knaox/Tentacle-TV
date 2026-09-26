import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { PlayerControlsProps } from "../../components/PlayerControls";

/**
 * Ce que le lecteur web partage avec la surcouche du miroir : l'habillage
 * tactile tient SA visibilité (tap, 4 s) et son état de glissé, et les rend au
 * lecteur — l'arbitre de segments et Watch Together les lisent.
 */
export interface MirrorPlayerBridge {
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;
  setScrubbing: (active: boolean) => void;
}

/** L'état du moteur web que l'habillage montre sans le décider. */
export interface MirrorPlayerMedia {
  /** La première image est rendue : avant, l'écran de chargement. */
  hasStarted: boolean;
  /** Mise en mémoire tampon en cours de lecture. */
  loading: boolean;
  /** Lecture automatique refusée par le navigateur : un tap pour lancer. */
  showPlayButton: boolean;
  setShowPlayButton: (v: boolean) => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  userInteractedRef: MutableRefObject<boolean>;
}

export interface MirrorPlayerOverlayProps {
  /** Les mêmes états et commandes que la barre du bureau (`PlayerControls`). */
  controls: PlayerControlsProps;
  /** L'arbitre partagé : pilule de saut, carte « à suivre », affiche de fin. */
  playback: PlaybackOverlayResult;
  bridge: MirrorPlayerBridge;
  media: MirrorPlayerMedia;
}

export interface TrackOption {
  index: number;
  label: string;
}
