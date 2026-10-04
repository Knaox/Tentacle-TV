import { useEffect, useMemo, useRef, useState } from "react";
import type { SeekWaitPhase } from "@tentacle-tv/shared";
import { createTranscodeSeekController, type TranscodeSeekState } from "./transcodeSeekController";

export interface TranscodeSeekInput {
  /** Le flux est converti par le serveur (ni lecture directe, ni fichier local). */
  transcoding: boolean;
  /** La durée du film en secondes (0 : inconnue). */
  duration: number;
  /** La position du film, lue au moment de l'appui. */
  position: () => number;
  /** Déplacer le moteur — une fois par série d'appuis, vers la cible cumulée. */
  apply: (target: number) => void;
}

export interface TranscodeSeek {
  /** Aller à une position du film (barre, télécommande, saut de segment). */
  seekTo: (target: number) => void;
  /** Un écart depuis la cible en cours (« +30 s », « −10 s », double toucher). */
  seekBy: (delta: number) => void;
  /** La position visée, à afficher pendant le regroupement et l'attente ; `null` sinon. */
  target: number | null;
  /** `loading` : l'indicateur ; `slow` : sa phrase ; `failed` : le modèle d'erreur. */
  phase: SeekWaitPhase;
  /** Un relevé du moteur : la position, et s'il charge — l'atterrissage s'y constate. */
  observe: (position: number, buffering: boolean) => void;
  /** Le moteur dit lui-même que le saut a abouti. */
  landed: () => void;
  /** Tout éteindre (erreur affichée, source changée). */
  reset: () => void;
}

/**
 * Le saut pendant un transcodage (`player/transcodeSeek.ts`) pour le mobile,
 * l'iPad, le web et le bureau : des sauts rapides regroupés en UN seul
 * déplacement du moteur — donc un seul ffmpeg relancé par Jellyfin —, et
 * l'attente dite jusqu'à ce que la vidéo revienne au passage visé. Hors
 * transcodage, le saut part tout de suite.
 */
export function useTranscodeSeek(input: TranscodeSeekInput): TranscodeSeek {
  const latest = useRef(input);
  latest.current = input;
  const [state, setState] = useState<TranscodeSeekState>({ target: null, phase: "idle" });

  const controller = useMemo(() => createTranscodeSeekController({
    transcoding: () => latest.current.transcoding,
    duration: () => latest.current.duration,
    position: () => latest.current.position(),
    apply: (target) => latest.current.apply(target),
    onChange: setState,
  }), []);

  useEffect(() => () => controller.reset(), [controller]);

  return useMemo(() => ({
    seekTo: (target: number) => controller.request({ to: target }),
    seekBy: (delta: number) => controller.request({ by: delta }),
    target: state.target,
    phase: state.phase,
    observe: controller.observe,
    landed: controller.landed,
    reset: controller.reset,
  }), [controller, state]);
}
